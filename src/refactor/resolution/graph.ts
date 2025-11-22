import type { GlobalOptions, JobDefinitionNormalized, ValidationError } from "../schema"
import { createValidationError, ValidationErrorCode } from "../schema"

/**
 * Graph node representing a job or template with extends relationships
 */
export interface ExtendsGraphNode {
  name: string
  definition: JobDefinitionNormalized
  extends: string[]
  isTemplate: boolean
  isRemote: boolean
}

/**
 * Result of extends resolution
 */
export interface ExtendsResolutionResult {
  resolved: Record<string, JobDefinitionNormalized>
  errors: ValidationError[]
  warnings: ValidationError[]
  skippedChecks: string[]
}

/**
 * Build extends dependency graph
 */
export function buildExtendsGraph(
  jobs: Record<string, JobDefinitionNormalized>,
  templates: Record<string, JobDefinitionNormalized>,
  options: { remote?: boolean } = {},
): Map<string, ExtendsGraphNode> {
  const graph = new Map<string, ExtendsGraphNode>()

  // Add all templates to graph
  for (const [name, definition] of Object.entries(templates)) {
    graph.set(name, {
      name,
      definition,
      extends: definition.extends ?? [],
      isTemplate: true,
      isRemote: options.remote ?? false,
    })
  }

  // Add all jobs to graph
  for (const [name, definition] of Object.entries(jobs)) {
    graph.set(name, {
      name,
      definition,
      extends: definition.extends ?? [],
      isTemplate: name.startsWith("."),
      isRemote: options.remote ?? false,
    })
  }

  return graph
}

/**
 * Detect cycles in extends graph using DFS
 * Returns array of cycles found (each cycle is an array of node names)
 */
export function detectCycles(graph: Map<string, ExtendsGraphNode>): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const currentPath: string[] = []

  function dfs(nodeName: string): void {
    if (recursionStack.has(nodeName)) {
      // Cycle detected - extract the cycle from current path
      const cycleStart = currentPath.indexOf(nodeName)
      if (cycleStart !== -1) {
        cycles.push([...currentPath.slice(cycleStart), nodeName])
      }
      return
    }

    if (visited.has(nodeName)) {
      return
    }

    visited.add(nodeName)
    recursionStack.add(nodeName)
    currentPath.push(nodeName)

    const node = graph.get(nodeName)
    if (node) {
      for (const extendName of node.extends) {
        // Try with and without dot prefix
        const targetName = graph.has(extendName) ? extendName : `.${extendName}`
        if (graph.has(targetName)) {
          dfs(targetName)
        }
      }
    }

    currentPath.pop()
    recursionStack.delete(nodeName)
  }

  // Run DFS from each node
  for (const nodeName of graph.keys()) {
    if (!visited.has(nodeName)) {
      dfs(nodeName)
    }
  }

  return cycles
}

/**
 * Check for missing extends targets
 */
export function findMissingExtends(graph: Map<string, ExtendsGraphNode>): Map<string, string[]> {
  const missing = new Map<string, string[]>()

  for (const [nodeName, node] of graph.entries()) {
    const missingTargets: string[] = []

    for (const extendName of node.extends) {
      // Check if target exists (with or without dot prefix)
      const hasTarget = graph.has(extendName) || graph.has(`.${extendName}`)

      if (!hasTarget) {
        missingTargets.push(extendName)
      }
    }

    if (missingTargets.length > 0) {
      missing.set(nodeName, missingTargets)
    }
  }

  return missing
}

/**
 * Topological sort of extends graph
 * Returns nodes in order (dependencies first)
 */
export function topologicalSort(graph: Map<string, ExtendsGraphNode>): string[] {
  const sorted: string[] = []
  const visited = new Set<string>()
  const temp = new Set<string>()

  function visit(nodeName: string): void {
    if (visited.has(nodeName)) {
      return
    }

    if (temp.has(nodeName)) {
      // Cycle detected, skip
      return
    }

    temp.add(nodeName)

    const node = graph.get(nodeName)
    if (node) {
      for (const extendName of node.extends) {
        // Try with and without dot prefix
        const targetName = graph.has(extendName) ? extendName : `.${extendName}`
        if (graph.has(targetName)) {
          visit(targetName)
        }
      }
    }

    temp.delete(nodeName)
    visited.add(nodeName)
    sorted.push(nodeName)
  }

  // Visit all nodes
  for (const nodeName of graph.keys()) {
    if (!visited.has(nodeName)) {
      visit(nodeName)
    }
  }

  return sorted
}

/**
 * Validate extends graph
 */
export function validateExtendsGraph(
  graph: Map<string, ExtendsGraphNode>,
  globalOptions: GlobalOptions,
): {
  errors: ValidationError[]
  warnings: ValidationError[]
  skippedChecks: string[]
} {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const skippedChecks: string[] = []

  // Check for missing extends targets
  const missing = findMissingExtends(graph)
  if (missing.size > 0) {
    const policy = globalOptions.missingExtendsPolicy

    for (const [jobName, targets] of missing.entries()) {
      const error = createValidationError(
        ValidationErrorCode.MISSING_EXTENDS_TARGET,
        `Job "${jobName}" extends from missing target(s): ${targets.join(", ")}`,
        [jobName, "extends"],
        { missingTargets: targets },
      )

      if (policy === "error") {
        errors.push(error)
      } else if (policy === "warn") {
        warnings.push(error)
      }
      // If policy is "ignore", do nothing
    }
  }

  // Check for cycles (skip in performance mode)
  if (globalOptions.performanceMode) {
    skippedChecks.push("cycle-detection")
  } else {
    const cycles = detectCycles(graph)
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        errors.push(
          createValidationError(
            ValidationErrorCode.CIRCULAR_EXTENDS,
            `Circular extends detected: ${cycle.join(" -> ")}`,
            undefined,
            {
              cycle,
            },
          ),
        )
      }
    }
  }

  return { errors, warnings, skippedChecks }
}
