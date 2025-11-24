import { load as parseYaml } from "js-yaml"

import type { IncludeInput, Stage, Workflow } from "../schema"
import type { BaseJob } from "../schema/job"
import type { ExtendsGraphNode } from "./graph"
import { ConfigBuilder } from "../builder/ConfigBuilder"

/**
 * Visualization format types
 */
export type VisualizationFormat = "mermaid" | "ascii" | "table" | "all"

/**
 * Options for visualization generation
 */
export interface VisualizeOptions {
  /** Output format */
  format?: VisualizationFormat
  /** Show job stages in output */
  showStages?: boolean
  /** Show remote template sources */
  showRemotes?: boolean
  /** GitLab authentication token for resolving project/template includes */
  gitlabToken?: string
  /** GitLab host URL for project/template includes (default: https://gitlab.com) */
  gitlabUrl?: string
}

/**
 * Result object containing requested visualizations
 */
export interface VisualizationResult {
  mermaid?: string
  ascii?: string
  table?: string
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  /** Show remote jobs with special indicator */
  showRemote?: boolean
  /** Show job stages in output */
  showStages?: boolean
  /** Highlight cycles if detected */
  highlightCycles?: boolean
}

/**
 * Resolved pipeline configuration with job definitions
 */
export interface ResolvedPipelineConfig {
  /** Job definitions with resolved properties */
  jobs?: Record<string, Pick<BaseJob, "stage">>
}

/**
 * Parameters for visualization functions
 */
export interface VisualizationParams {
  /** Extends graph with node metadata */
  graph: Map<string, ExtendsGraphNode>
  /** Resolved pipeline configuration */
  resolvedConfig: ResolvedPipelineConfig
  /** Visualization options */
  options?: VisualizationOptions
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
  options: VisualizeOptions = { format: "all" },
): Promise<VisualizationResult> {
  const parsed = parseYaml(yamlContent) as Record<string, unknown>
  const config = new ConfigBuilder()

  // Add stages if present
  if (parsed.stages) {
    config.stages(...((Array.isArray(parsed.stages) ? parsed.stages : [parsed.stages]) as Stage[]))
  }

  // Add includes if present (must be added before resolving)
  if (parsed.include) {
    config.include(parsed.include as IncludeInput | IncludeInput[])
  }

  // Resolve includes BEFORE adding jobs/templates
  if (parsed.include) {
    const { resolveIncludes } = await import("../resolver/cli")
    await resolveIncludes(config, {
      gitlabToken: options.gitlabToken,
      gitlabUrl: options.gitlabUrl,
    })
  }

  // Add variables if present
  if (parsed.variables && typeof parsed.variables === "object") {
    config.variables(parsed.variables as Record<string, string | number | boolean>)
  }

  // Add workflow if present
  if (parsed.workflow && typeof parsed.workflow === "object") {
    config.workflow(parsed.workflow as Workflow)
  }

  // Add jobs and templates AFTER resolving includes
  for (const [name, definition] of Object.entries(parsed)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      !["stages", "variables", "workflow", "include", "default", "spec"].includes(name)
    ) {
      if (name.startsWith(".")) {
        config.template(name, definition)
      } else {
        config.job(name, definition)
      }
    }
  }

  const graph = config.getExtendsGraph()
  const resolvedConfig = config.getPlainObject({ skipValidation: true })
  const { generateMermaidDiagram, generateAsciiTree, generateStageTable } = await import(
    "../resolution"
  )

  const vizOptions = {
    showStages: options.showStages,
    showRemotes: options.showRemotes,
  }

  const result: VisualizationResult = {}

  if (options.format === "all" || options.format === "mermaid") {
    result.mermaid = generateMermaidDiagram({ graph, resolvedConfig, options: vizOptions })
  }

  if (options.format === "all" || options.format === "ascii") {
    result.ascii = generateAsciiTree({ graph, resolvedConfig, options: vizOptions })
  }

  if (options.format === "all" || options.format === "table") {
    result.table = generateStageTable({ graph, resolvedConfig, options: vizOptions })
  }

  return result
}

/**
 * Generate Mermaid diagram from extends graph
 */
export function generateMermaidDiagram({
  graph,
  resolvedConfig,
  options = {},
}: VisualizationParams): string {
  const lines: string[] = ["graph TD"]

  // Define node styles
  lines.push("  classDef template fill:#e1f5ff,stroke:#0366d6")
  lines.push("  classDef job fill:#fff5e1,stroke:#fb8500")
  lines.push("  classDef remote fill:#ffe1f5,stroke:#c026d3")

  const nodeIds = new Map<string, string>()
  let counter = 0

  // Generate unique IDs for nodes
  for (const name of graph.keys()) {
    nodeIds.set(name, `n${counter++}`)
  }

  // Add nodes
  for (const [name, node] of graph.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nodeId = nodeIds.get(name)!
    const label = name.replace(/"/g, '\\"')
    // Use resolved stage from resolvedConfig for jobs, fallback to graph definition for templates
    const resolvedStage = resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage
    const stage = options.showStages && resolvedStage ? ` [${resolvedStage}]` : ""
    const remote = options.showRemote && node.isRemote ? " 🌐" : ""

    let nodeClass = ""
    if (node.isRemote) {
      nodeClass = ":::remote"
    } else if (node.isTemplate) {
      nodeClass = ":::template"
    } else {
      nodeClass = ":::job"
    }

    lines.push(`  ${nodeId}["${label}${stage}${remote}"]${nodeClass}`)
  }

  // Add edges
  for (const [name, node] of graph.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nodeId = nodeIds.get(name)!

    for (const extendName of node.extends) {
      const targetName = graph.has(extendName) ? extendName : `.${extendName}`
      const targetId = nodeIds.get(targetName)

      if (targetId) {
        lines.push(`  ${nodeId} --> ${targetId}`)
      }
    }
  }

  return lines.join("\n")
}

/**
 * Generate ASCII tree from extends graph
 */
export function generateAsciiTree({
  graph,
  resolvedConfig,
  options = {},
}: VisualizationParams): string {
  const lines: string[] = []
  const visited = new Set<string>()

  function renderNode(name: string, prefix = "", isLast = true): void {
    if (visited.has(name)) {
      return
    }
    visited.add(name)

    const node = graph.get(name)
    if (!node) return

    const connector = isLast ? "└─" : "├─"
    const remote = options.showRemote && node.isRemote ? " 🌐" : ""
    const template = node.isTemplate ? " [T]" : ""
    // Use resolved stage from resolvedConfig for jobs, fallback to graph definition for templates
    const resolvedStage = resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage
    const stage = options.showStages && resolvedStage ? ` (${resolvedStage})` : ""

    lines.push(`${prefix}${connector} ${name}${template}${remote}${stage}`)

    const childPrefix = prefix + (isLast ? "  " : "│ ")
    const extends_ = node.extends

    for (let i = 0; i < extends_.length; i++) {
      const extendName = extends_[i]
      if (!extendName) continue

      const targetName = graph.has(extendName) ? extendName : `.${extendName}`

      if (graph.has(targetName)) {
        renderNode(targetName, childPrefix, i === extends_.length - 1)
      } else {
        // Missing target
        const connector = i === extends_.length - 1 ? "└─" : "├─"
        lines.push(`${childPrefix}${connector} ${extendName} ⚠️  (missing)`)
      }
    }
  }

  // Find root nodes (jobs/templates that are not extended by anyone)
  const extendedNodes = new Set<string>()
  for (const node of graph.values()) {
    for (const ext of node.extends) {
      const targetName = graph.has(ext) ? ext : `.${ext}`
      extendedNodes.add(targetName)
    }
  }

  const rootNodes = Array.from(graph.keys()).filter((name) => !extendedNodes.has(name))

  // Render each root node
  for (let i = 0; i < rootNodes.length; i++) {
    const rootNode = rootNodes[i]
    if (rootNode) {
      renderNode(rootNode, "", i === rootNodes.length - 1)
    }
  }

  return lines.join("\n")
}

/**
 * Generate CLI table with stages as columns
 */
export function generateStageTable({
  graph,
  resolvedConfig,
  options = {},
}: VisualizationParams): string {
  // Collect all stages from resolved jobs (resolvedConfig) instead of graph
  const stagesSet = new Set<string>()
  for (const job of Object.values(resolvedConfig.jobs ?? {})) {
    if (job.stage) {
      stagesSet.add(job.stage)
    }
  }

  const stages = Array.from(stagesSet)
  if (stages.length === 0) {
    return "No stages defined"
  }

  // Group jobs by stage using resolved jobs from resolvedConfig
  const jobsByStage = new Map<string, string[]>()
  for (const stage of stages) {
    jobsByStage.set(stage, [])
  }

  for (const [name, job] of Object.entries(resolvedConfig.jobs ?? {})) {
    const stage = job.stage ?? "test"
    if (jobsByStage.has(stage)) {
      // Look up metadata from graph
      const node = graph.get(name)
      const remote = options.showRemote && node?.isRemote ? " 🌐" : ""
      const template = node?.isTemplate ? " [T]" : ""
      const extends_ =
        node?.extends && node.extends.length > 0 ? ` ← ${node.extends.join(", ")}` : ""
      const stageJobs = jobsByStage.get(stage)
      if (stageJobs) {
        stageJobs.push(`${name}${template}${remote}${extends_}`)
      }
    }
  }

  // Calculate column widths
  const maxJobsInStage = Math.max(...Array.from(jobsByStage.values()).map((jobs) => jobs.length))
  const columnWidth = Math.max(
    ...stages.map((s) => s.length),
    ...Array.from(jobsByStage.values())
      .flat()
      .map((j) => j.length),
  )

  // Build table
  const lines: string[] = []

  // Header
  const header = stages.map((s) => s.padEnd(columnWidth)).join(" │ ")
  lines.push(header)
  lines.push(stages.map(() => "─".repeat(columnWidth)).join("─┼─"))

  // Rows
  for (let i = 0; i < maxJobsInStage; i++) {
    const row = stages.map((stage) => {
      const jobs = jobsByStage.get(stage) ?? []
      return (jobs[i] ?? "").padEnd(columnWidth)
    })
    lines.push(row.join(" │ "))
  }

  return lines.join("\n")
}
