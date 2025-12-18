import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { JobDefinitionNormalized } from "../schema"
import type { ExtendsGraphNode } from "./graph"
import { ConfigBuilder } from "../builder"
import { parseYaml } from "../importer/parser"
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

/**
 * Load child pipeline configuration from trigger include
 *
 * @param triggerInclude - The include configuration from trigger
 * @param basePath - Base path for resolving local files
 * @returns Parsed child pipeline config or null if cannot be loaded
 */
function loadChildPipelineConfig(
  triggerInclude: unknown,
  basePath?: string,
): { config: ConfigBuilder; source: string } | null {
  if (!triggerInclude || typeof triggerInclude !== "object") {
    return null
  }

  const include = triggerInclude as Record<string, unknown>

  // Handle local file includes
  if ("local" in include && typeof include.local === "string") {
    try {
      const filePath = basePath ? resolve(basePath, include.local) : include.local
      const yamlContent = readFileSync(filePath, "utf-8")
      const parsed = parseYaml(yamlContent)

      const config = new ConfigBuilder()

      // Handle empty or null parsed result
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!parsed || typeof parsed !== "object") {
        return { config, source: include.local }
      }

      // Add stages
      if (parsed.stages) {
        config.stages(
          ...((Array.isArray(parsed.stages) ? parsed.stages : [parsed.stages]) as string[]),
        )
      }

      // Add jobs and templates
      for (const [name, definition] of Object.entries(parsed)) {
        if (
          typeof definition === "object" &&
          definition !== null &&
          !["stages", "variables", "workflow", "include", "default", "spec"].includes(name)
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

      return { config, source: include.local }
    } catch {
      return null
    }
  }

  // Handle artifact includes (can't be loaded at build time)
  if ("artifact" in include && typeof include.artifact === "string") {
    return { config: new ConfigBuilder(), source: `artifact:${include.artifact}` }
  }

  // Handle array of includes
  if (Array.isArray(include)) {
    for (const item of include) {
      const result = loadChildPipelineConfig(item, basePath)
      if (result) return result
    }
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
export function extractChildPipelines(
  graph: Map<string, ExtendsGraphNode>,
  basePath?: string,
  trackedChildPipelines?: ReadonlyMap<string, TrackedChildPipeline>,
): ChildPipelineInfo[] {
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
        const builder = trackedConfig.builder
        const jobs = builder.jobs
        const templates = builder.templates
        const jobOptionsMap = builder.jobOptionsMap

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
    const childConfig = loadChildPipelineConfig(node.trigger.include, basePath)
    if (!childConfig) {
      continue
    }

    // Build graph for child pipeline
    const jobs = childConfig.config.jobs as Record<string, JobDefinitionNormalized>
    const templates = childConfig.config.templates as Record<string, JobDefinitionNormalized>
    const jobOptionsMap = childConfig.config.jobOptionsMap

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
