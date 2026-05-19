import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { ConfigBuilder } from "../builder/config-builder"
import { parseYaml } from "../importer/parser"
import type { JobDefinitionNormalized } from "../schema/job"
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
    jobs: Record<string, JobDefinitionNormalized>
    templates: Record<string, JobDefinitionNormalized>
    jobOptionsMap: Record<string, Record<string, unknown>>
    getStages(): string[]
  }
  outputPath: string
}

async function handleLocalInclude(
  include: Record<string, unknown>,
  basePath?: string
): Promise<{ config: ConfigBuilder; source: string } | null> {
  try {
    const filePath = basePath
      ? resolve(basePath, include.local as string)
      : (include.local as string)
    const yamlContent = readFileSync(filePath, "utf-8")
    const parsed = parseYaml(yamlContent)

    const { ConfigBuilder } = await import("../builder/config-builder")
    const config = new ConfigBuilder()

    // Handle empty or null parsed result
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!parsed || typeof parsed !== "object") {
      return { config, source: include.local as string }
    }

    // Add stages
    if ((parsed as Record<string, unknown>).stages) {
      config.stages(
        ...((Array.isArray((parsed as Record<string, unknown>).stages)
          ? (parsed as Record<string, unknown>).stages
          : [(parsed as Record<string, unknown>).stages]) as string[])
      )
    }

    // Add jobs and templates
    const RESERVED_KEYS = new Set([
      "stages",
      "variables",
      "workflow",
      "include",
      "default",
      "spec",
    ])
    for (const [name, definition] of Object.entries(parsed)) {
      if (
        typeof definition === "object" &&
        definition !== null &&
        !RESERVED_KEYS.has(name)
      ) {
        try {
          if (name.startsWith(".")) {
            config.template(name, definition)
          } else {
            config.job(name, definition)
          }
        } catch {
          // Skip invalid jobs
        }
      }
    }

    return { config, source: include.local as string }
  } catch {
    return null
  }
}

async function handleArtifactInclude(
  include: Record<string, unknown>
): Promise<{ config: ConfigBuilder; source: string }> {
  const { ConfigBuilder } = await import("../builder/config-builder")
  return {
    config: new ConfigBuilder(),
    source: `artifact:${include.artifact as string}`,
  }
}

async function handleArrayInclude(
  include: unknown[],
  basePath?: string
): Promise<{ config: ConfigBuilder; source: string } | null> {
  for (const item of include) {
    const result = await loadChildPipelineConfig(item, basePath)
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
async function loadChildPipelineConfig(
  triggerInclude: unknown,
  basePath?: string
): Promise<{ config: ConfigBuilder; source: string } | null> {
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
 * @returns Array of child pipeline information
 */
export async function extractChildPipelines(
  graph: Map<string, ExtendsGraphNode>,
  basePath?: string,
  trackedChildPipelines?: ReadonlyMap<string, TrackedChildPipeline>
): Promise<ChildPipelineInfo[]> {
  const childPipelines: ChildPipelineInfo[] = []

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

    // Fallback: Try to load from file system
    const childConfig = await loadChildPipelineConfig(
      node.trigger.include,
      basePath
    )
    if (!childConfig) {
      continue
    }

    // Build graph for child pipeline
    const jobs = childConfig.config.jobs as Record<
      string,
      JobDefinitionNormalized
    >
    const templates = childConfig.config.templates as Record<
      string,
      JobDefinitionNormalized
    >
    const { jobOptionsMap } = childConfig.config

    const childGraph = buildExtendsGraph(jobs, templates, jobOptionsMap)

    const resolvedConfig = {
      jobs: jobs as Record<string, { stage?: string }>,
      stages: [...childConfig.config.getStages()],
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
