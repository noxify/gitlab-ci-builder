import { ConfigBuilder } from "../builder/config-builder"
import { parseYaml } from "../importer/parser"
import { resolveIncludes } from "../resolver/cli"
import type { Stage } from "../schema/base"
import type { IncludeInput } from "../schema/include"
import type { JobDefinitionInput } from "../schema/job"
import type { Workflow } from "../schema/workflow"
import type { ExtendsGraphNode } from "./graph"
import type {
  ResolvedPipelineConfig,
  VisualizationFormat,
  VisualizationOptions,
  VisualizationResult,
  VisualizeOptions,
} from "./visualization"
import {
  generateAsciiTree,
  generateMermaidDiagram,
  generateStageTable,
} from "./visualization"

/**
 * Minimal ConfigBuilder surface used while assembling a pipeline from parsed YAML.
 */
interface VisualizationConfigBuilder {
  include: (include: IncludeInput | IncludeInput[]) => this
  stages: (...stages: Stage[]) => this
  variables: (variables: Record<string, string | number | boolean>) => this
  workflow: (workflow: Workflow) => this
  template: (name: string, definition: JobDefinitionInput) => this
  job: (name: string, definition: JobDefinitionInput) => this
  getExtendsGraph: () => Map<string, ExtendsGraphNode>
  getPlainObject: (options?: {
    skipValidation?: boolean
  }) => ResolvedPipelineConfig
}

/**
 * Generate visualizations from a GitLab CI YAML content
 *
 * @param yamlContent - The YAML content as string
 * @param options - Visualization options
 * @returns Object containing the requested visualization formats
 *
 * @example
 * ```ts
 * const yaml = `
 * stages: [build, test]
 * build:
 *   stage: build
 *   script: npm run build
 * `
 * const result = await visualizeYaml(yaml, { format: 'ascii' })
 * console.log(result.ascii)
 * ```
 */
export async function visualizeYaml(
  yamlContent: string,
  options: VisualizeOptions = {}
): Promise<VisualizationResult> {
  const format = options.format ?? "all"
  const parsed = parseYaml(yamlContent)
  const config = new ConfigBuilder()

  const unresolvedExtends = captureUnresolvedExtends(parsed)
  addConfigStages(config, parsed)
  await resolveIncludesIfPresent(config, parsed, options)
  addConfigVariables(config, parsed)
  addConfigWorkflow(config, parsed)
  addJobsAndTemplates(config, parsed)

  const graph = config.getExtendsGraph()
  mergeUnresolvedExtends(graph, unresolvedExtends)

  const resolvedConfig = config.getPlainObject({ skipValidation: true })
  const vizOptions = {
    showStages: options.showStages,
    showRemotes: options.showRemotes,
  }

  return generateVisualizations(graph, resolvedConfig, vizOptions, format)
}

function captureUnresolvedExtends(
  parsed: Record<string, unknown>
): Map<string, string[]> {
  const unresolvedExtends = new Map<string, string[]>()
  for (const [name, definition] of Object.entries(parsed)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      ![
        "stages",
        "variables",
        "workflow",
        "include",
        "default",
        "spec",
      ].includes(name)
    ) {
      const def = definition as Record<string, unknown>
      if (def.extends) {
        const extendsValue = Array.isArray(def.extends)
          ? def.extends
          : [def.extends]
        unresolvedExtends.set(name, extendsValue as string[])
      }
    }
  }
  return unresolvedExtends
}

function addConfigStages(
  config: VisualizationConfigBuilder,
  parsed: Record<string, unknown>
): void {
  if (parsed.stages) {
    config.stages(
      ...((Array.isArray(parsed.stages)
        ? parsed.stages
        : [parsed.stages]) as Stage[])
    )
  }
}

async function resolveIncludesIfPresent(
  config: VisualizationConfigBuilder,
  parsed: Record<string, unknown>,
  options: VisualizeOptions
): Promise<void> {
  if (!parsed.include) {
    return
  }

  config.include(parsed.include as IncludeInput | IncludeInput[])

  const { failedIncludes } = await resolveIncludes(
    config as unknown as ConfigBuilder,
    {
      gitlabToken: options.gitlabToken,
      gitlabUrl: options.gitlabUrl,
      resolveReferences: true,
    }
  )

  if (failedIncludes.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  Warning: ${failedIncludes.length} include(s) could not be loaded. Visualization may be incomplete.`
    )
  }
}

function addConfigVariables(
  config: VisualizationConfigBuilder,
  parsed: Record<string, unknown>
): void {
  if (parsed.variables && typeof parsed.variables === "object") {
    config.variables(
      parsed.variables as Record<string, string | number | boolean>
    )
  }
}

function addConfigWorkflow(
  config: VisualizationConfigBuilder,
  parsed: Record<string, unknown>
): void {
  if (parsed.workflow && typeof parsed.workflow === "object") {
    try {
      config.workflow(parsed.workflow as Workflow)
    } catch {
      // Ignore validation errors
    }
  }
}

function addJobsAndTemplates(
  config: VisualizationConfigBuilder,
  parsed: Record<string, unknown>
): void {
  for (const [name, definition] of Object.entries(parsed)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      ![
        "stages",
        "variables",
        "workflow",
        "include",
        "default",
        "spec",
      ].includes(name)
    ) {
      try {
        if (name.startsWith(".")) {
          config.template(name, definition)
        } else {
          config.job(name, definition)
        }
      } catch {
        // Silently skip jobs with validation errors
      }
    }
  }
}

function mergeUnresolvedExtends(
  graph: Map<string, ExtendsGraphNode>,
  unresolvedExtends: Map<string, string[]>
): void {
  for (const [name, node] of graph.entries()) {
    const unresolved = unresolvedExtends.get(name)
    if (unresolved) {
      node.unresolvedExtends = unresolved
    }
  }
}

function generateVisualizations(
  graph: Map<string, ExtendsGraphNode>,
  resolvedConfig: ResolvedPipelineConfig,
  vizOptions: VisualizationOptions,
  format: VisualizationFormat = "all"
): VisualizationResult {
  const result: VisualizationResult = {}

  if (format === "all" || format === "mermaid") {
    result.mermaid = generateMermaidDiagram({
      graph,
      resolvedConfig,
      options: vizOptions,
    })
  }

  if (format === "all" || format === "ascii") {
    result.ascii = generateAsciiTree({
      graph,
      resolvedConfig,
      options: vizOptions,
    })
  }

  if (format === "all" || format === "table") {
    result.table = generateStageTable({
      graph,
      resolvedConfig,
      options: vizOptions,
    })
  }

  return result
}
