import { ClimtTable } from "climt"
import { AsciiTree } from "oo-ascii-tree"

import type { ConfigBuilder } from "../builder/config-builder"
import { parseYaml } from "../importer/parser"
import type { Stage } from "../schema/base"
import type { IncludeInput } from "../schema/include"
import type { BaseJob } from "../schema/job"
import type { Workflow } from "../schema/workflow"
import type { ChildPipelineInfo, TrackedChildPipeline } from "./child-pipeline"
import { extractChildPipelines } from "./child-pipeline"
import type { ExtendsGraphNode } from "./graph"

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
  /** Show child pipelines triggered by jobs */
  showChildPipelines?: boolean
  /** Base path for resolving local child pipeline files */
  basePath?: string
  /** GitLab authentication token for resolving project/template includes */
  gitlabToken?: string
  /** GitLab host URL for project/template includes (default: https://gitlab.com) */
  gitlabUrl?: string
}

interface VisualizationConfigBuilder {
  include(include: IncludeInput | IncludeInput[]): this
  stages(...stages: Stage[]): this
  variables(variables: Record<string, string | number | boolean>): this
  workflow(workflow: Workflow): this
  template(name: string, definition: unknown): this
  job(name: string, definition: unknown): this
  getExtendsGraph(): Map<string, ExtendsGraphNode>
  getPlainObject(options?: { skipValidation?: boolean }): ResolvedPipelineConfig
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
  /** Show child pipelines triggered by jobs */
  showChildPipelines?: boolean
  /** Base path for resolving local child pipeline files */
  basePath?: string
}

/**
 * Resolved pipeline configuration with job definitions
 */
export interface ResolvedPipelineConfig {
  /** Job definitions with resolved properties */
  jobs?: Record<string, Pick<BaseJob, "stage">>
  /** Pipeline stages */
  stages?: string[]
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
  /** Tracked child pipelines from ConfigBuilder state */
  trackedChildPipelines?: ReadonlyMap<string, TrackedChildPipeline>
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
  const { ConfigBuilder } = await import("../builder/config-builder")
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

  const { resolveIncludes } = await import("../resolver/cli")
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

export function generateMermaidDiagram({
  graph,
  resolvedConfig,
  options = {},
  trackedChildPipelines,
}: VisualizationParams): string {
  const lines: string[] = [
    "---",
    "config:",
    "  layout: elk",
    "---",
    "graph LR",
    "  classDef template fill:#e1f5ff,stroke:#0366d6",
    "  classDef job fill:#fff5e1,stroke:#fb8500",
    "  classDef remote fill:#ffe1f5,stroke:#c026d3",
  ]

  const nodeIds = generateNodeIds(graph)
  addMermaidNodes(lines, graph, resolvedConfig, nodeIds, options)
  addMermaidEdges(lines, graph, nodeIds, options)
  addMermaidChildPipelines(
    lines,
    graph,
    nodeIds,
    options,
    trackedChildPipelines
  )

  return lines.join("\n")
}

function generateNodeIds(
  graph: Map<string, ExtendsGraphNode>
): Map<string, string> {
  const nodeIds = new Map<string, string>()
  let counter = 0
  for (const name of graph.keys()) {
    nodeIds.set(name, `n${counter}`)
    counter += 1
  }
  return nodeIds
}

function addMermaidNodes(
  lines: string[],
  graph: Map<string, ExtendsGraphNode>,
  resolvedConfig: ResolvedPipelineConfig,
  nodeIds: Map<string, string>,
  options: VisualizationOptions
): void {
  if (
    options.showStages &&
    resolvedConfig.stages &&
    resolvedConfig.stages.length > 0
  ) {
    addMermaidStages(lines, graph, resolvedConfig, nodeIds, options)
  } else {
    addMermaidFlatNodes(lines, graph, resolvedConfig, nodeIds, options)
  }
}

function addMermaidStages(
  lines: string[],
  graph: Map<string, ExtendsGraphNode>,
  resolvedConfig: ResolvedPipelineConfig,
  nodeIds: Map<string, string>,
  options: VisualizationOptions
): void {
  const jobsByStage = new Map<string, string[]>()
  const templatesWithoutStage: string[] = []

  for (const [name, node] of graph.entries()) {
    const resolvedStage =
      resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage

    if (resolvedStage) {
      if (!jobsByStage.has(resolvedStage)) {
        jobsByStage.set(resolvedStage, [])
      }
      jobsByStage.get(resolvedStage)?.push(name)
    } else {
      templatesWithoutStage.push(name)
    }
  }

  if (templatesWithoutStage.length > 0) {
    lines.push("  subgraph Templates")
    for (const name of templatesWithoutStage) {
      addMermaidNode(lines, name, graph, nodeIds, options, null)
    }
    lines.push("  end")
  }

  for (const stage of resolvedConfig.stages ?? []) {
    const jobsInStage = jobsByStage.get(stage)
    if (!jobsInStage || jobsInStage.length === 0) {
      continue
    }

    lines.push(
      `  subgraph ${stage.replaceAll(/[^a-zA-Z0-9_]/gu, "_")}["${stage}"]`
    )
    for (const name of jobsInStage) {
      addMermaidNode(lines, name, graph, nodeIds, options, stage)
    }
    lines.push("  end")
  }
}

function addMermaidFlatNodes(
  lines: string[],
  graph: Map<string, ExtendsGraphNode>,
  resolvedConfig: ResolvedPipelineConfig,
  nodeIds: Map<string, string>,
  options: VisualizationOptions
): void {
  for (const [name, node] of graph.entries()) {
    const resolvedStage =
      resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage ?? null
    addMermaidNode(lines, name, graph, nodeIds, options, resolvedStage)
  }
}

function addMermaidNode(
  lines: string[],
  name: string,
  graph: Map<string, ExtendsGraphNode>,
  nodeIds: Map<string, string>,
  options: VisualizationOptions,
  stage: string | null
): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const nodeId = nodeIds.get(name)!
  const node = graph.get(name)
  const label = name.replaceAll('"', '\\"')
  const remote = options.showRemote && node?.isRemote ? " 🌐" : ""
  const stageStr = stage ? ` [${stage}]` : ""

  let nodeClass = ""
  if (node?.isRemote) {
    nodeClass = ":::remote"
  } else if (node?.isTemplate) {
    nodeClass = ":::template"
  } else if (stage) {
    nodeClass = ":::job"
  }

  lines.push(`    ${nodeId}["${label}${stageStr}${remote}"]${nodeClass}`)
}

function addMermaidEdges(
  lines: string[],
  graph: Map<string, ExtendsGraphNode>,
  nodeIds: Map<string, string>,
  _options: VisualizationOptions
): void {
  for (const [name, node] of graph.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nodeId = nodeIds.get(name)!

    for (const extendName of node.extends) {
      let targetName = extendName
      if (!graph.has(extendName)) {
        targetName = extendName.startsWith(".") ? extendName : `.${extendName}`
      }

      let targetId = nodeIds.get(targetName)

      if (!targetId && !graph.has(targetName)) {
        targetId = `n_missing_${extendName.replaceAll(/[^a-zA-Z0-9_]/gu, "_")}`
        nodeIds.set(targetName, targetId)

        const label = targetName.replaceAll('"', '\\"')
        lines.push(`  ${targetId}["${label} ⚠️"]:::template`)
        lines.push(`  style ${targetId} stroke-dasharray: 5 5,stroke:#fb8500`)
      }

      if (targetId) {
        lines.push(`  ${nodeId} --> ${targetId}`)
      }
    }
  }
}

async function addMermaidChildPipelines(
  lines: string[],
  graph: Map<string, ExtendsGraphNode>,
  nodeIds: Map<string, string>,
  options: VisualizationOptions,
  trackedChildPipelines: ReadonlyMap<string, TrackedChildPipeline> | undefined
): Promise<void> {
  if (!options.showChildPipelines) {
    return
  }

  lines.push("  classDef childPipeline fill:#e1ffe8,stroke:#22c55e")

  const childPipelines = await extractChildPipelines(
    graph,
    options.basePath,
    trackedChildPipelines
  )

  for (const child of childPipelines) {
    const parentNodeId = nodeIds.get(child.parentJob)
    if (!parentNodeId) {
      continue
    }

    const subgraphId = `child_${child.parentJob.replaceAll(/[^a-zA-Z0-9_]/gu, "_")}`
    const subgraphLabel = `Child Pipeline: ${child.source}`

    lines.push(`  subgraph ${subgraphId}["${subgraphLabel}"]`)

    let counter = 0
    const childNodeIds = new Map<string, string>()

    for (const [childJobName, childNode] of child.graph.entries()) {
      const childNodeId = `n_child_${counter}`
      counter += 1
      childNodeIds.set(childJobName, childNodeId)

      const label = childJobName.replaceAll('"', '\\"')
      const stage =
        options.showStages && childNode.definition.stage
          ? ` [${childNode.definition.stage}]`
          : ""

      const nodeClass = childNode.isTemplate
        ? ":::template"
        : ":::childPipeline"

      lines.push(`    ${childNodeId}["${label}${stage}"]${nodeClass}`)
    }

    lines.push("  end")

    const [firstChildJob] = child.graph.keys()
    if (firstChildJob) {
      const firstChildNodeId = childNodeIds.get(firstChildJob)
      if (firstChildNodeId) {
        lines.push(`  ${parentNodeId} -.->|"triggers"| ${firstChildNodeId}`)
      }
    }

    for (const [childJobName, childNode] of child.graph.entries()) {
      const childNodeId = childNodeIds.get(childJobName)
      if (!childNodeId) {
        continue
      }

      for (const extendName of childNode.extends) {
        const targetId = childNodeIds.get(extendName)
        if (targetId) {
          lines.push(`    ${childNodeId} --> ${targetId}`)
        }
      }
    }
  }
}

/**
 * Generate ASCII tree representation from extends graph.
 *
 * Creates a hierarchical tree view showing job inheritance relationships.
 * Root nodes (not extended by anyone) are shown at the top, with their
 * extends relationships displayed as children.
 *
 * Features:
 * - Shows template [T] and remote 🌐 indicators
 * - Displays job stages when enabled
 * - Detects and prevents infinite loops from circular extends
 * - Shows missing templates with ⚠️ warning
 * - Displays original unresolved extends when different from resolved
 *
 * @param params - Visualization parameters
 * @param params.graph - Extends graph with node metadata
 * @param params.resolvedConfig - Resolved pipeline configuration
 * @param params.options - Visualization options (showRemote, showStages)
 * @returns ASCII tree representation as string
 *
 * @example
 * ```ts
 * const output = generateAsciiTree({ graph, resolvedConfig })
 * // Returns:
 * // ├── build-job
 * // │   └── .build-template [T]
 * // └── test-job (test)
 * //     └── .test-template [T]
 * ```
 */
export function generateAsciiTree({
  graph,
  resolvedConfig,
  options = {},
  trackedChildPipelines,
}: VisualizationParams): string {
  const root = new AsciiTree()
  const rootNodes = findRootNodes(graph)

  for (const rootNode of rootNodes) {
    const node = buildAsciiNode(rootNode, graph, resolvedConfig, options)
    if (node) {
      root.add(node)
    }
  }

  if (options.showChildPipelines) {
    addAsciiChildPipelines(root, graph, options, trackedChildPipelines)
  }

  return root.toString()
}

function findRootNodes(graph: Map<string, ExtendsGraphNode>): string[] {
  const extendedNodes = new Set<string>()
  for (const node of graph.values()) {
    for (const ext of node.extends) {
      const targetName = graph.has(ext) ? ext : `.${ext}`
      extendedNodes.add(targetName)
    }
  }
  return [...graph.keys()].filter((name) => !extendedNodes.has(name))
}

function buildAsciiNode(
  name: string,
  graph: Map<string, ExtendsGraphNode>,
  resolvedConfig: ResolvedPipelineConfig,
  options: VisualizationOptions,
  visited = new Set<string>()
): AsciiTree | null {
  const node = graph.get(name)
  if (!node) {
    return null
  }

  const remote = options.showRemote && node.isRemote ? " 🌐" : ""
  const template = node.isTemplate ? " [T]" : ""
  const resolvedStage =
    resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage
  const stage = options.showStages && resolvedStage ? ` (${resolvedStage})` : ""

  const treeNode = new AsciiTree(`${name}${template}${remote}${stage}`)

  if (visited.has(name)) {
    return treeNode
  }

  const newVisited = new Set([...visited, name])

  for (const extendName of node.extends) {
    const targetName = graph.has(extendName) ? extendName : `.${extendName}`

    if (graph.has(targetName)) {
      const childNode = buildAsciiNode(
        targetName,
        graph,
        resolvedConfig,
        options,
        newVisited
      )
      if (childNode) {
        treeNode.add(childNode)
      }
    } else {
      treeNode.add(new AsciiTree(`${extendName} ⚠️ (missing)`))
    }
  }

  if (node.unresolvedExtends && node.unresolvedExtends.length > 0) {
    const unresolvedDiff = node.unresolvedExtends.filter(
      (u) => !node.extends.includes(u)
    )

    if (unresolvedDiff.length > 0) {
      treeNode.add(new AsciiTree(`📜 original: ${unresolvedDiff.join(", ")}`))
    }
  }

  return treeNode
}

async function addAsciiChildPipelines(
  root: AsciiTree,
  graph: Map<string, ExtendsGraphNode>,
  options: VisualizationOptions,
  trackedChildPipelines: ReadonlyMap<string, TrackedChildPipeline> | undefined
): Promise<void> {
  const childPipelines = await extractChildPipelines(
    graph,
    options.basePath,
    trackedChildPipelines
  )

  for (const child of childPipelines) {
    const parentNode = graph.get(child.parentJob)
    if (!parentNode) {
      continue
    }

    const childPipelineNode = new AsciiTree(
      `🔀 Child Pipeline: ${child.source}`
    )
    const childRootNodes = findChildRootNodes(child.graph)

    for (const childRootName of childRootNodes) {
      const node = child.graph.get(childRootName)
      if (!node) {
        continue
      }

      const childTreeNode = buildChildAsciiNode(
        childRootName,
        node,
        child,
        options
      )
      childPipelineNode.add(childTreeNode)
    }

    root.add(childPipelineNode)
  }
}

function findChildRootNodes(graph: Map<string, ExtendsGraphNode>): string[] {
  const childExtendedNodes = new Set<string>()
  for (const node of graph.values()) {
    for (const ext of node.extends) {
      const targetName = graph.has(ext) ? ext : `.${ext}`
      childExtendedNodes.add(targetName)
    }
  }
  return [...graph.keys()].filter((name) => !childExtendedNodes.has(name))
}

function buildChildAsciiNode(
  name: string,
  node: ExtendsGraphNode,
  child: ChildPipelineInfo,
  options: VisualizationOptions
): AsciiTree {
  const childTemplate = node.isTemplate ? " [T]" : ""
  const childStage =
    options.showStages && node.definition.stage
      ? ` (${node.definition.stage})`
      : ""

  const childTreeNode = new AsciiTree(`${name}${childTemplate}${childStage}`)

  for (const extendName of node.extends) {
    const targetNode = child.graph.get(extendName)
    if (targetNode) {
      const targetTemplate = targetNode.isTemplate ? " [T]" : ""
      const targetStage =
        options.showStages && targetNode.definition.stage
          ? ` (${targetNode.definition.stage})`
          : ""
      childTreeNode.add(
        new AsciiTree(`${extendName}${targetTemplate}${targetStage}`)
      )
    }
  }

  return childTreeNode
}

export function generateStageTable({
  graph,
  resolvedConfig,
  options = {},
  trackedChildPipelines,
}: VisualizationParams): string {
  const stagesSet = new Set<string>()
  for (const job of Object.values(resolvedConfig.jobs ?? {})) {
    if (job.stage) {
      stagesSet.add(job.stage)
    }
  }

  const stages = [...stagesSet]
  if (stages.length === 0) {
    return "No stages defined"
  }

  const tableData: { stage: string; job: string }[] = []
  const jobsByStage = groupJobsByStage(graph, resolvedConfig, stages, options)

  for (const stage of stages) {
    const jobs = jobsByStage.get(stage) ?? []
    for (const job of jobs) {
      tableData.push({ stage, job })
    }
  }

  if (options.showChildPipelines) {
    addChildPipelinesToTable(tableData, graph, options, trackedChildPipelines)
  }

  return renderTable(tableData)
}

function groupJobsByStage(
  graph: Map<string, ExtendsGraphNode>,
  resolvedConfig: ResolvedPipelineConfig,
  stages: string[],
  options: VisualizationOptions
): Map<string, string[]> {
  const jobsByStage = new Map<string, string[]>()
  for (const stage of stages) {
    jobsByStage.set(stage, [])
  }

  for (const [name, job] of Object.entries(resolvedConfig.jobs ?? {})) {
    const stage = job.stage ?? "test"

    if (name.startsWith(".")) {
      continue
    }

    if (jobsByStage.has(stage)) {
      const node = graph.get(name)
      const jobLabel = buildJobLabel(name, node, options)
      const stageJobs = jobsByStage.get(stage)
      if (stageJobs) {
        stageJobs.push(jobLabel)
      }
    }
  }

  return jobsByStage
}

function buildJobLabel(
  name: string,
  node: ExtendsGraphNode | undefined,
  options: VisualizationOptions
): string {
  const remote = options.showRemote && node?.isRemote ? " 🌐" : ""
  const template = node?.isTemplate ? " [T]" : ""
  const trigger = node?.trigger?.include ? " 🔀" : ""

  let extendsChain = ""
  if (node?.extends && node.extends.length > 0) {
    const uniqueChain = [...new Set(node.extends)]
    extendsChain = ` ← ${uniqueChain.join(" ← ")}`
  }

  return `${name}${template}${remote}${trigger}${extendsChain}`
}

async function addChildPipelinesToTable(
  tableData: { stage: string; job: string }[],
  graph: Map<string, ExtendsGraphNode>,
  options: VisualizationOptions,
  trackedChildPipelines: ReadonlyMap<string, TrackedChildPipeline> | undefined
): Promise<void> {
  const childPipelines = await extractChildPipelines(
    graph,
    options.basePath,
    trackedChildPipelines
  )

  for (const child of childPipelines) {
    tableData.push({
      stage: "─".repeat(15),
      job: "─".repeat(50),
    })

    tableData.push({
      stage: "CHILD PIPELINE",
      job: `🔀 ${child.source} (triggered by ${child.parentJob})`,
    })

    const childStagesSet = new Set<string>()
    for (const job of Object.values(child.resolvedConfig.jobs ?? {})) {
      if (job.stage) {
        childStagesSet.add(job.stage)
      }
    }

    for (const childStage of childStagesSet) {
      for (const [childName, childJob] of Object.entries(
        child.resolvedConfig.jobs ?? {}
      )) {
        const stage = childJob.stage ?? "test"

        if (childName.startsWith(".") || stage !== childStage) {
          continue
        }

        const childNode = child.graph.get(childName)
        const childTemplate = childNode?.isTemplate ? " [T]" : ""

        let childExtendsChain = ""
        if (childNode?.extends && childNode.extends.length > 0) {
          const uniqueExtends = [...new Set(childNode.extends)]
          childExtendsChain = ` ← ${uniqueExtends.join(" ← ")}`
        }

        tableData.push({
          stage: childStage,
          job: `  ${childName}${childTemplate}${childExtendsChain}`,
        })
      }
    }
  }
}

function renderTable(tableData: { stage: string; job: string }[]): string {
  const table = new ClimtTable()
  table.column("Stage", "stage")
  table.column("Job", "job")

  table.format((content, _col, row) => {
    if (row === -1) {
      return content.toUpperCase()
    }
    return content
  })

  const lines: string[] = []
  // eslint-disable-next-line no-console
  const originalLog = console.log
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    lines.push(args.join(" "))
  }

  try {
    table.render(tableData)
  } finally {
    // eslint-disable-next-line no-console
    console.log = originalLog
  }

  return lines.join("\n")
}
