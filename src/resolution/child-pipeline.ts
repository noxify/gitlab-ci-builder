import { readFileSync } from "node:fs"
import path from "node:path"

import { parseYaml } from "../importer/parser"
import type { JobDefinitionNormalized } from "../schema/job"
import type { JobOptions } from "../schema/policies"
import type { ExtendsGraphNode } from "./graph"
import { buildExtendsGraph } from "./graph"

/**
 * Information about a child pipeline
 */
export interface ChildPipelineInfo {
  /** Parent job name that triggers this child pipeline */
  parentJob: string
  /** Child pipeline configuration graph */
  graph: Map<string, ExtendsGraphNode>
  /** Child pipeline resolved config */
  resolvedConfig: {
    jobs?: Record<string, { stage?: string }>
    stages?: string[]
  }
  /** Source of the child pipeline (local file path, artifact, etc.) */
  source: string
}

/**
 * Tracked child pipeline from ConfigBuilder state
 */
export interface TrackedChildPipeline {
  jobName: string
  builder: {
    jobs: Readonly<Record<string, JobDefinitionNormalized>>
    templates: Readonly<Record<string, JobDefinitionNormalized>>
    jobOptionsMap: Readonly<Record<string, JobOptions>>
    getStages: () => readonly string[]
  }
  outputPath: string
}

/**
 * Lightweight parsed child pipeline config.
 *
 * Built directly from parsed YAML (no ConfigBuilder) to keep child pipeline
 * extraction synchronous and free of a cyclic dependency on the builder.
 */
interface ParsedChildConfig {
  jobs: Record<string, JobDefinitionNormalized>
  templates: Record<string, JobDefinitionNormalized>
  jobOptionsMap: Record<string, JobOptions>
  stages: string[]
}

const RESERVED_KEYS = new Set([
  "stages",
  "variables",
  "workflow",
  "include",
  "default",
  "spec",
])

/**
 * Normalize a raw parsed job/template definition to the shape the extends graph
 * expects. Mirrors ConfigBuilder's handling: a scalar `extends` becomes a
 * single-element array.
 */
function normalizeChildDefinition(
  definition: Record<string, unknown>
): JobDefinitionNormalized {
  const normalized = { ...definition } as Record<string, unknown>

  if (typeof normalized.extends === "string") {
    normalized.extends = [normalized.extends]
  }

  return normalized as JobDefinitionNormalized
}

function parseChildPipelineYaml(parsed: unknown): ParsedChildConfig {
  const config: ParsedChildConfig = {
    jobs: {},
    templates: {},
    jobOptionsMap: {},
    stages: [],
  }

  if (!parsed || typeof parsed !== "object") {
    return config
  }

  const parsedRecord = parsed as Record<string, unknown>

  if (parsedRecord.stages) {
    config.stages = (
      Array.isArray(parsedRecord.stages)
        ? parsedRecord.stages
        : [parsedRecord.stages]
    ) as string[]
  }

  for (const [name, definition] of Object.entries(parsedRecord)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      !RESERVED_KEYS.has(name)
    ) {
      const normalized = normalizeChildDefinition(
        definition as Record<string, unknown>
      )
      if (name.startsWith(".")) {
        config.templates[name] = normalized
      } else {
        config.jobs[name] = normalized
      }
    }
  }

  return config
}

function handleLocalInclude(
  include: Record<string, unknown>,
  basePath?: string
): { config: ParsedChildConfig; source: string } | null {
  try {
    const filePath = basePath
      ? path.resolve(basePath, include.local as string)
      : (include.local as string)
    const yamlContent = readFileSync(filePath, "utf-8")
    const parsed = parseYaml(yamlContent)

    return {
      config: parseChildPipelineYaml(parsed),
      source: include.local as string,
    }
  } catch {
    return null
  }
}

function handleArtifactInclude(include: Record<string, unknown>): {
  config: ParsedChildConfig
  source: string
} {
  return {
    config: { jobs: {}, templates: {}, jobOptionsMap: {}, stages: [] },
    source: `artifact:${include.artifact as string}`,
  }
}

function handleArrayInclude(
  include: unknown[],
  basePath?: string
): { config: ParsedChildConfig; source: string } | null {
  for (const item of include) {
    const result = loadChildPipelineConfig(item, basePath)
    if (result) {
      return result
    }
  }
  return null
}

/**
 * Load child pipeline configuration from trigger include
 *
 * @param triggerInclude - The include configuration from trigger
 * @param basePath - Base path for resolving local files
 * @returns Parsed child pipeline config or null if cannot be loaded
 */
function loadChildPipelineConfig(
  triggerInclude: unknown,
  basePath?: string
): { config: ParsedChildConfig; source: string } | null {
  if (!triggerInclude || typeof triggerInclude !== "object") {
    return null
  }

  const include = triggerInclude as Record<string, unknown>

  if ("local" in include && typeof include.local === "string") {
    return handleLocalInclude(include, basePath)
  }

  if ("artifact" in include && typeof include.artifact === "string") {
    return handleArtifactInclude(include)
  }

  if (Array.isArray(include)) {
    return handleArrayInclude(include, basePath)
  }

  return null
}

/**
 * Extract child pipeline information from a graph
 *
 * @param graph - The extends graph containing jobs and templates
 * @param basePath - Base path for resolving local child pipeline files
 * @param trackedChildPipelines - Optional map of child pipelines from ConfigBuilder state
 * @returns Promise resolving to an array of child pipeline information
 */
export function extractChildPipelines(
  graph: Map<string, ExtendsGraphNode>,
  basePath?: string,
  trackedChildPipelines?: ReadonlyMap<string, TrackedChildPipeline>
): Promise<ChildPipelineInfo[]> {
  return Promise.resolve(
    extractChildPipelinesSync(graph, basePath, trackedChildPipelines)
  )
}

/**
 * Synchronous variant of {@link extractChildPipelines}.
 *
 * Child pipeline extraction is fully synchronous (local includes are read with
 * readFileSync and parsed in-process). This variant is used internally by the
 * synchronous visualization generators; the public async wrapper is retained for
 * backwards compatibility.
 *
 * @param graph - The extends graph containing jobs and templates
 * @param basePath - Base path for resolving local child pipeline files
 * @param trackedChildPipelines - Optional map of child pipelines from ConfigBuilder state
 * @returns Array of child pipeline information
 */
export function extractChildPipelinesSync(
  graph: Map<string, ExtendsGraphNode>,
  basePath?: string,
  trackedChildPipelines?: ReadonlyMap<string, TrackedChildPipeline>
): ChildPipelineInfo[] {
  const childPipelines: ChildPipelineInfo[] = []
  const pendingLoads: { name: string; include: unknown }[] = []

  for (const [name, node] of graph.entries()) {
    // Skip if no trigger or if it's a downstream pipeline (project trigger)
    if (!node.trigger || node.trigger.project) {
      continue
    }

    // Only process child pipelines (trigger with include)
    if (!node.trigger.include) {
      continue
    }

    // First, check if this child pipeline is tracked in ConfigBuilder
    if (trackedChildPipelines) {
      const trackedConfig = trackedChildPipelines.get(name)
      if (trackedConfig) {
        const { builder } = trackedConfig
        const { jobs } = builder
        const { templates } = builder
        const { jobOptionsMap } = builder

        const childGraph = buildExtendsGraph(jobs, templates, jobOptionsMap)

        const resolvedConfig = {
          jobs: jobs as Record<string, { stage?: string }>,
          stages: [...builder.getStages()],
        }

        childPipelines.push({
          parentJob: name,
          graph: childGraph,
          resolvedConfig,
          source: trackedConfig.outputPath,
        })

        continue
      }
    }

    // Collect items that need async loading
    pendingLoads.push({ name, include: node.trigger.include })
  }

  // Load all child pipeline configs
  for (const pending of pendingLoads) {
    const childConfig = loadChildPipelineConfig(pending.include, basePath)
    if (!childConfig) {
      continue
    }

    const { name } = pending

    // Build graph for child pipeline
    const { jobs, templates, jobOptionsMap } = childConfig.config

    const childGraph = buildExtendsGraph(jobs, templates, jobOptionsMap)

    const resolvedConfig = {
      jobs: jobs as Record<string, { stage?: string }>,
      stages: [...childConfig.config.stages],
    }

    childPipelines.push({
      parentJob: name,
      graph: childGraph,
      resolvedConfig,
      source: childConfig.source,
    })
  }

  return childPipelines
}
