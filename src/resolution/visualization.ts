import { ClimtTable } from "climt"
import { AsciiTree } from "oo-ascii-tree"

import type { IncludeInput, Stage, Workflow } from "../schema"
import type { BaseJob } from "../schema/job"
import type { TrackedChildPipeline } from "./child-pipeline"
import type { ExtendsGraphNode } from "./graph"
import { ConfigBuilder } from "../builder/ConfigBuilder"
import { parseYaml } from "../importer/parser"
import { resolveIncludes } from "../resolver/cli"
import { extractChildPipelines } from "./child-pipeline"

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
  options: VisualizeOptions = { format: "all" },
): Promise<VisualizationResult> {
  const parsed = parseYaml(yamlContent)
  const config = new ConfigBuilder()

  // Store unresolved extends before include resolution
  const unresolvedExtends = new Map<string, string[]>()
  for (const [name, definition] of Object.entries(parsed)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      !["stages", "variables", "workflow", "include", "default", "spec"].includes(name)
    ) {
      const def = definition as Record<string, unknown>
      if (def.extends) {
        const extendsValue = Array.isArray(def.extends) ? def.extends : [def.extends]
        unresolvedExtends.set(name, extendsValue as string[])
      }
    }
  }

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
    const { failedIncludes } = await resolveIncludes(config, {
      gitlabToken: options.gitlabToken,
      gitlabUrl: options.gitlabUrl,
      resolveReferences: true, // Enable !reference resolution for visualization
    })

    if (failedIncludes.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️  Warning: ${failedIncludes.length} include(s) could not be loaded. Visualization may be incomplete.`,
      )
    }
  }

  // Add variables if present
  if (parsed.variables && typeof parsed.variables === "object") {
    config.variables(parsed.variables as Record<string, string | number | boolean>)
  }

  // Add workflow if present
  if (parsed.workflow && typeof parsed.workflow === "object") {
    try {
      config.workflow(parsed.workflow as Workflow)
    } catch {
      // Ignore validation errors for visualization
    }
  }

  // Add jobs and templates AFTER resolving includes
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
        // Silently skip jobs with validation errors for visualization
      }
    }
  }

  const graph = config.getExtendsGraph()

  // Merge unresolved extends into graph nodes
  for (const [name, node] of graph.entries()) {
    const unresolved = unresolvedExtends.get(name)
    if (unresolved) {
      node.unresolvedExtends = unresolved
    }
  }

  const resolvedConfig = config.getPlainObject({ skipValidation: true })

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
  trackedChildPipelines,
}: VisualizationParams): string {
  const lines: string[] = ["---", "config:", "  layout: elk", "---", "graph LR"]

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

  // Group jobs by stage if showStages is enabled
  if (options.showStages && resolvedConfig.stages && resolvedConfig.stages.length > 0) {
    const jobsByStage = new Map<string, string[]>()
    const templatesWithoutStage: string[] = []

    // Group jobs and templates by stage
    for (const [name, node] of graph.entries()) {
      const resolvedStage = resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage

      if (resolvedStage) {
        if (!jobsByStage.has(resolvedStage)) {
          jobsByStage.set(resolvedStage, [])
        }
        jobsByStage.get(resolvedStage)?.push(name)
      } else {
        templatesWithoutStage.push(name)
      }
    }

    // Add templates without stage first
    if (templatesWithoutStage.length > 0) {
      lines.push("  subgraph Templates")
      for (const name of templatesWithoutStage) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nodeId = nodeIds.get(name)!
        const label = name.replace(/"/g, '\\"')
        const node = graph.get(name)
        const remote = options.showRemote && node?.isRemote ? " 🌐" : ""

        let nodeClass = ""
        if (node?.isRemote) {
          nodeClass = ":::remote"
        } else if (node?.isTemplate) {
          nodeClass = ":::template"
        }

        lines.push(`    ${nodeId}["${label}${remote}"]${nodeClass}`)
      }
      lines.push("  end")
    }

    // Add stages in order
    for (const stage of resolvedConfig.stages) {
      const jobsInStage = jobsByStage.get(stage)
      if (!jobsInStage || jobsInStage.length === 0) continue

      lines.push(`  subgraph ${stage.replace(/[^a-zA-Z0-9_]/g, "_")}["${stage}"]`)

      for (const name of jobsInStage) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nodeId = nodeIds.get(name)!
        const label = name.replace(/"/g, '\\"')
        const node = graph.get(name)
        const remote = options.showRemote && node?.isRemote ? " 🌐" : ""

        let nodeClass = ""
        if (node?.isRemote) {
          nodeClass = ":::remote"
        } else if (node?.isTemplate) {
          nodeClass = ":::template"
        } else {
          nodeClass = ":::job"
        }

        lines.push(`    ${nodeId}["${label}${remote}"]${nodeClass}`)
      }

      lines.push("  end")
    }
  } else {
    // No stage grouping - add all nodes flat
    for (const [name, node] of graph.entries()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const nodeId = nodeIds.get(name)!
      const label = name.replace(/"/g, '\\"')
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
  }

  // Add edges (resolved extends - solid lines)
  for (const [name, node] of graph.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nodeId = nodeIds.get(name)!

    for (const extendName of node.extends) {
      // Try both with and without dot prefix
      let targetName = extendName
      if (!graph.has(extendName)) {
        targetName = extendName.startsWith(".") ? extendName : `.${extendName}`
      }

      let targetId = nodeIds.get(targetName)

      // If target doesn't exist in graph, create a missing node
      if (!targetId && !graph.has(targetName)) {
        targetId = `n${counter++}`
        nodeIds.set(targetName, targetId)

        // Add missing node with warning styling
        const label = targetName.replace(/"/g, '\\"')
        lines.push(`  ${targetId}["${label} ⚠️"]:::template`)
        lines.push(`  style ${targetId} stroke-dasharray: 5 5,stroke:#fb8500`)
      }

      if (targetId) {
        lines.push(`  ${nodeId} --> ${targetId}`)
      }
    }
  }

  // Add unresolved edges (dotted lines for original extends before resolution)
  for (const [name, node] of graph.entries()) {
    if (!node.unresolvedExtends || node.unresolvedExtends.length === 0) continue

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nodeId = nodeIds.get(name)!

    for (const unresolvedExtend of node.unresolvedExtends) {
      // Skip if this is already in the resolved extends (to avoid duplicate edges)
      if (node.extends.includes(unresolvedExtend)) continue

      // Try to find the target
      let targetName = unresolvedExtend
      if (!graph.has(unresolvedExtend)) {
        targetName = unresolvedExtend.startsWith(".") ? unresolvedExtend : `.${unresolvedExtend}`
      }

      let targetId = nodeIds.get(targetName)

      // If target doesn't exist, create a missing node
      if (!targetId && !graph.has(targetName)) {
        targetId = `n${counter++}`
        nodeIds.set(targetName, targetId)

        const label = targetName.replace(/"/g, '\\"')
        lines.push(`  ${targetId}["${label} ⚠️"]:::template`)
        lines.push(`  style ${targetId} stroke-dasharray: 5 5,stroke:#fb8500`)
      }

      if (targetId) {
        // Dotted line for unresolved extends (shows original source)
        lines.push(`  ${nodeId} -.->|"original"| ${targetId}`)
      }
    }
  }

  // Add child pipelines if enabled
  if (options.showChildPipelines) {
    lines.push("  classDef childPipeline fill:#e1ffe8,stroke:#22c55e")

    const childPipelines = extractChildPipelines(graph, options.basePath, trackedChildPipelines)

    for (const child of childPipelines) {
      const parentNodeId = nodeIds.get(child.parentJob)
      if (!parentNodeId) continue

      const subgraphId = `child_${child.parentJob.replace(/[^a-zA-Z0-9_]/g, "_")}`
      const subgraphLabel = `Child Pipeline: ${child.source}`

      lines.push(`  subgraph ${subgraphId}["${subgraphLabel}"]`)

      // Add child pipeline nodes
      for (const [childJobName, childNode] of child.graph.entries()) {
        const childNodeId = `n${counter++}`
        nodeIds.set(`${child.parentJob}:${childJobName}`, childNodeId)

        const label = childJobName.replace(/"/g, '\\"')
        const stage =
          options.showStages && childNode.definition.stage ? ` [${childNode.definition.stage}]` : ""

        let nodeClass = ""
        if (childNode.isTemplate) {
          nodeClass = ":::template"
        } else {
          nodeClass = ":::childPipeline"
        }

        lines.push(`    ${childNodeId}["${label}${stage}"]${nodeClass}`)
      }

      lines.push("  end")

      // Add trigger connection from parent to first job in child
      const firstChildJob = Array.from(child.graph.keys())[0]
      if (firstChildJob) {
        const firstChildNodeId = nodeIds.get(`${child.parentJob}:${firstChildJob}`)
        if (firstChildNodeId) {
          lines.push(`  ${parentNodeId} -.->|"triggers"| ${firstChildNodeId}`)
        }
      }

      // Add extends relationships within child pipeline
      for (const [childJobName, childNode] of child.graph.entries()) {
        const childNodeId = nodeIds.get(`${child.parentJob}:${childJobName}`)
        if (!childNodeId) continue

        for (const extendName of childNode.extends) {
          const targetId = nodeIds.get(`${child.parentJob}:${extendName}`)
          if (targetId) {
            lines.push(`    ${childNodeId} --> ${targetId}`)
          }
        }
      }
    }
  }

  return lines.join("\n")
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
  function buildNode(name: string, visited = new Set<string>()): AsciiTree | null {
    const node = graph.get(name)
    if (!node) return null

    const remote = options.showRemote && node.isRemote ? " 🌐" : ""
    const template = node.isTemplate ? " [T]" : ""
    const resolvedStage = resolvedConfig.jobs?.[name]?.stage ?? node.definition.stage
    const stage = options.showStages && resolvedStage ? ` (${resolvedStage})` : ""

    const treeNode = new AsciiTree(`${name}${template}${remote}${stage}`)

    // Detect cycles
    if (visited.has(name)) {
      return treeNode
    }

    const newVisited = new Set(visited)
    newVisited.add(name)

    // Add resolved extends as children
    for (const extendName of node.extends) {
      const targetName = graph.has(extendName) ? extendName : `.${extendName}`

      if (graph.has(targetName)) {
        const childNode = buildNode(targetName, newVisited)
        if (childNode) {
          treeNode.add(childNode)
        }
      } else {
        // Missing target
        treeNode.add(new AsciiTree(`${extendName} ⚠️ (missing)`))
      }
    }

    // Show unresolved extends if different from resolved
    if (node.unresolvedExtends && node.unresolvedExtends.length > 0) {
      const unresolvedDiff = node.unresolvedExtends.filter((u) => !node.extends.includes(u))

      if (unresolvedDiff.length > 0) {
        treeNode.add(new AsciiTree(`📜 original: ${unresolvedDiff.join(", ")}`))
      }
    }

    return treeNode
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

  // Build the tree
  const root = new AsciiTree()
  for (const rootNode of rootNodes) {
    const node = buildNode(rootNode)
    if (node) {
      root.add(node)
    }
  }

  // Add child pipelines if enabled
  if (options.showChildPipelines) {
    const childPipelines = extractChildPipelines(graph, options.basePath, trackedChildPipelines)

    for (const child of childPipelines) {
      const parentNode = graph.get(child.parentJob)
      if (!parentNode) continue

      const childPipelineLabel = `🔀 Child Pipeline: ${child.source}`
      const childPipelineNode = new AsciiTree(childPipelineLabel)

      // Build tree for child pipeline jobs
      const childExtendedNodes = new Set<string>()
      for (const node of child.graph.values()) {
        for (const ext of node.extends) {
          const targetName = child.graph.has(ext) ? ext : `.${ext}`
          childExtendedNodes.add(targetName)
        }
      }

      const childRootNodes = Array.from(child.graph.keys()).filter(
        (name) => !childExtendedNodes.has(name),
      )

      for (const childRootName of childRootNodes) {
        const childNode = child.graph.get(childRootName)
        if (!childNode) continue

        const childTemplate = childNode.isTemplate ? " [T]" : ""
        const childStage =
          options.showStages && childNode.definition.stage ? ` (${childNode.definition.stage})` : ""
        const childTreeNode = new AsciiTree(`${childRootName}${childTemplate}${childStage}`)

        // Add extends for child jobs
        for (const extendName of childNode.extends) {
          const targetNode = child.graph.get(extendName)
          if (targetNode) {
            const targetTemplate = targetNode.isTemplate ? " [T]" : ""
            const targetStage =
              options.showStages && targetNode.definition.stage
                ? ` (${targetNode.definition.stage})`
                : ""
            childTreeNode.add(new AsciiTree(`${extendName}${targetTemplate}${targetStage}`))
          }
        }

        childPipelineNode.add(childTreeNode)
      }

      root.add(childPipelineNode)
    }
  }

  return root.toString()
}

/**
 * Generate formatted table showing stages and jobs.
 *
 * Creates a two-column table displaying:
 * - Stage name in the first column
 * - Job name with extends chain in the second column
 *
 * Features:
 * - Groups jobs by stage
 * - Shows complete extends inheritance chain
 * - Displays remote 🌐 and template [T] indicators
 * - Excludes template jobs (starting with .)
 * - Shows full inheritance chain using ← arrows
 *
 * @param params - Visualization parameters
 * @param params.graph - Extends graph with node metadata
 * @param params.resolvedConfig - Resolved pipeline configuration
 * @param params.options - Visualization options (showRemote)
 * @returns Formatted table as string
 *
 * @example
 * ```ts
 * const table = generateStageTable({ graph, resolvedConfig })
 * // Returns:
 * // ┌───────┬─────────────────────────────────┐
 * // │ STAGE │ JOB                             │
 * // ├───────┼─────────────────────────────────┤
 * // │ build │ build-job ← .build-template     │
 * // │ test  │ test-job ← .test-template       │
 * // └───────┴─────────────────────────────────┘
 * ```
 */
export function generateStageTable({
  graph,
  resolvedConfig,
  options = {},
  trackedChildPipelines,
}: VisualizationParams): string {
  // Collect all stages from resolved jobs
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

  // Group jobs by stage
  const jobsByStage = new Map<string, string[]>()
  for (const stage of stages) {
    jobsByStage.set(stage, [])
  }

  for (const [name, job] of Object.entries(resolvedConfig.jobs ?? {})) {
    const stage = job.stage ?? "test"

    // Skip templates (jobs starting with .)
    if (name.startsWith(".")) {
      continue
    }

    if (jobsByStage.has(stage)) {
      const node = graph.get(name)
      const remote = options.showRemote && node?.isRemote ? " 🌐" : ""
      const template = node?.isTemplate ? " [T]" : ""
      const trigger = node?.trigger?.include ? " 🔀" : ""

      // Build full extends chain
      let extendsChain = ""
      if (node?.extends && node.extends.length > 0) {
        const chain: string[] = []

        // Build chain recursively
        const buildChain = (currentName: string) => {
          const currentNode = graph.get(currentName)
          if (currentNode?.extends && currentNode.extends.length > 0) {
            for (const ext of currentNode.extends) {
              chain.push(ext)
              buildChain(ext)
            }
          }
        }

        for (const ext of node.extends) {
          chain.push(ext)
          buildChain(ext)
        }

        // Remove duplicates while preserving order
        const uniqueChain = Array.from(new Set(chain))
        extendsChain = ` ← ${uniqueChain.join(" ← ")}`
      }

      const stageJobs = jobsByStage.get(stage)
      if (stageJobs) {
        stageJobs.push(`${name}${template}${remote}${trigger}${extendsChain}`)
      }
    }
  }

  // Build table data - one row per job
  const tableData: { stage: string; job: string }[] = []
  for (const stage of stages) {
    const jobs = jobsByStage.get(stage) ?? []
    for (const job of jobs) {
      tableData.push({
        stage,
        job,
      })
    }
  }

  // Add child pipeline jobs if enabled
  if (options.showChildPipelines) {
    const childPipelines = extractChildPipelines(graph, options.basePath, trackedChildPipelines)

    for (const child of childPipelines) {
      // Add separator for child pipeline
      tableData.push({
        stage: "─".repeat(15),
        job: "─".repeat(50),
      })

      tableData.push({
        stage: "CHILD PIPELINE",
        job: `🔀 ${child.source} (triggered by ${child.parentJob})`,
      })

      // Group child jobs by stage
      const childStagesSet = new Set<string>()
      for (const job of Object.values(child.resolvedConfig.jobs ?? {})) {
        if (job.stage) {
          childStagesSet.add(job.stage)
        }
      }

      const childStages = Array.from(childStagesSet)

      // Group child jobs by stage
      const childJobsByStage = new Map<string, string[]>()
      for (const childStage of childStages) {
        childJobsByStage.set(childStage, [])
      }

      for (const [childName, childJob] of Object.entries(child.resolvedConfig.jobs ?? {})) {
        const childStage = childJob.stage ?? "test"

        // Skip templates
        if (childName.startsWith(".")) {
          continue
        }

        if (childJobsByStage.has(childStage)) {
          const childNode = child.graph.get(childName)
          const childTemplate = childNode?.isTemplate ? " [T]" : ""

          let childExtendsChain = ""
          if (childNode?.extends && childNode.extends.length > 0) {
            const uniqueExtends = Array.from(new Set(childNode.extends))
            childExtendsChain = ` ← ${uniqueExtends.join(" ← ")}`
          }

          const stageJobs = childJobsByStage.get(childStage)
          if (stageJobs) {
            stageJobs.push(`  ${childName}${childTemplate}${childExtendsChain}`)
          }
        }
      }

      // Add child jobs to table
      for (const childStage of childStages) {
        const childJobs = childJobsByStage.get(childStage) ?? []
        for (const childJob of childJobs) {
          tableData.push({
            stage: childStage,
            job: childJob,
          })
        }
      }
    }
  }

  // Create and configure table
  const table = new ClimtTable()
  table.column("Stage", "stage")
  table.column("Job", "job")

  // Format header to uppercase
  table.format((content, _col, row) => {
    if (row === -1) {
      return content.toUpperCase()
    }
    return content
  })

  // Capture console.log output
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
