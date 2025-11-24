import type { ExtendsGraphNode } from "./graph"

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
 * Generate Mermaid diagram from extends graph
 */
export function generateMermaidDiagram(
  graph: Map<string, ExtendsGraphNode>,
  options: VisualizationOptions = {},
): string {
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
    const stage = options.showStages && node.definition.stage ? ` [${node.definition.stage}]` : ""
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
export function generateAsciiTree(
  graph: Map<string, ExtendsGraphNode>,
  options: VisualizationOptions = {},
): string {
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
    const stage = options.showStages && node.definition.stage ? ` (${node.definition.stage})` : ""

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
export function generateStageTable(
  graph: Map<string, ExtendsGraphNode>,
  options: VisualizationOptions = {},
): string {
  // Collect all stages
  const stagesSet = new Set<string>()
  for (const node of graph.values()) {
    if (node.definition.stage) {
      stagesSet.add(node.definition.stage)
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

  for (const [name, node] of graph.entries()) {
    const stage = node.definition.stage
    if (stage && jobsByStage.has(stage)) {
      const remote = options.showRemote && node.isRemote ? " 🌐" : ""
      const template = node.isTemplate ? " [T]" : ""
      const extends_ = node.extends.length > 0 ? ` ← ${node.extends.join(", ")}` : ""
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

/**
 * Generate all visualizations
 */
export function generateAllVisualizations(
  graph: Map<string, ExtendsGraphNode>,
  options: VisualizationOptions = {},
): {
  mermaid: string
  ascii: string
  table: string
} {
  return {
    mermaid: generateMermaidDiagram(graph, options),
    ascii: generateAsciiTree(graph, options),
    table: generateStageTable(graph, options),
  }
}
