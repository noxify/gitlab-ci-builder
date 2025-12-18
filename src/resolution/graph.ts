import type { GlobalOptions, JobDefinitionNormalized, JobOptions, ValidationError } from "../schema"
import { createValidationError, ValidationErrorCode } from "../schema"

/**
 * Trigger configuration for child/downstream pipelines
 */
export interface TriggerInfo {
  /** Project path for downstream pipeline */
  project?: string
  /** Include configuration for child pipeline */
  include?: unknown
  /** Strategy: 'depend' waits for completion, 'mirror' mirrors status */
  strategy?: "depend" | "mirror"
}

/**
 * Graph node representing a job or template with extends relationships
 */
export interface ExtendsGraphNode {
  name: string
  definition: JobDefinitionNormalized
  extends: string[]
  /** Original unresolved extends before include resolution */
  unresolvedExtends?: string[]
  isTemplate: boolean
  isRemote: boolean
  /** Trigger configuration if this job triggers a pipeline */
  trigger?: TriggerInfo
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
 * Build extends dependency graph from jobs and templates.
 *
 * Creates a graph structure representing all jobs and templates with their
 * extends relationships. This is used for visualization and validation.
 *
 * @param jobs - Job definitions map
 * @param templates - Template definitions map
 * @param jobOptionsMap - Job-specific options map
 * @returns Map of job/template names to their graph nodes
 *
 * @example
 * ```ts
 * const jobs = {
 *   'build': { stage: 'build', script: 'build.sh' }
 * }
 * const templates = {
 *   '.base': { script: 'base.sh' }
 * }
 *
 * const graph = buildExtendsGraph(jobs, templates)
 * for (const [name, node] of graph) {
 *   console.log(`${name}: extends ${node.extends.join(', ')}`)
 * }
 * ```
 */
export function buildExtendsGraph(
  jobs: Record<string, JobDefinitionNormalized>,
  templates: Record<string, JobDefinitionNormalized>,
  jobOptionsMap: Record<string, JobOptions> = {},
): Map<string, ExtendsGraphNode> {
  const graph = new Map<string, ExtendsGraphNode>()

  // Add all templates to graph
  for (const [name, definition] of Object.entries(templates)) {
    const jobOpts = jobOptionsMap[name]
    graph.set(name, {
      name,
      definition,
      extends: definition.extends ?? [],
      isTemplate: true,
      isRemote: jobOpts?.remote ?? false,
    })
  }

  // Add all jobs to graph
  for (const [name, definition] of Object.entries(jobs)) {
    const jobOpts = jobOptionsMap[name]

    // Extract trigger info if present
    let triggerInfo: TriggerInfo | undefined
    if (definition.trigger) {
      if (typeof definition.trigger === "string") {
        triggerInfo = { project: definition.trigger }
      } else if (typeof definition.trigger === "object") {
        const trigger = definition.trigger as Record<string, unknown>
        triggerInfo = {
          project: trigger.project as string | undefined,
          include: trigger.include,
          strategy: trigger.strategy as "depend" | "mirror" | undefined,
        }
      }
    }

    graph.set(name, {
      name,
      definition,
      extends: definition.extends ?? [],
      isTemplate: name.startsWith("."),
      isRemote: jobOpts?.remote ?? false,
      trigger: triggerInfo,
    })
  }

  return graph
}

/**
 * Detect cycles in extends graph using depth-first search.
 *
 * Circular extends relationships are invalid in GitLab CI and will cause
 * pipeline failures. This function detects such cycles.
 *
 * @param graph - The extends graph to check
 * @returns Array of cycles found (each cycle is an array of node names forming the cycle)
 *
 * @example
 * ```ts
 * // Given: A extends B, B extends C, C extends A (circular)
 * const cycles = detectCycles(graph)
 * // Returns: [['A', 'B', 'C', 'A']]
 * ```
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
 * Check for missing extends targets in the graph.
 *
 * Identifies jobs that extend from templates or jobs that don't exist
 * in the configuration.
 *
 * @param graph - The extends graph to check
 * @returns Map of job names to their missing extend targets
 *
 * @example
 * ```ts
 * // Given: job 'build' extends '.missing-template' which doesn't exist
 * const missing = findMissingExtends(graph)
 * // Returns: Map { 'build' => ['.missing-template'] }
 * ```
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
 * Topological sort of extends graph.
 *
 * Returns nodes in dependency order (dependencies first). This ensures that
 * when merging extends, parent definitions are processed before children.
 *
 * @param graph - The extends graph to sort
 * @returns Array of node names in topological order
 *
 * @example
 * ```ts
 * // Given: A extends B, B extends C
 * const sorted = topologicalSort(graph)
 * // Returns: ['C', 'B', 'A'] (dependencies first)
 * ```
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
 * Validate extends graph for common errors.
 *
 * Checks for:
 * - Missing extends targets
 * - Circular extends relationships (unless in performance mode)
 *
 * @param graph - The extends graph to validate
 * @param globalOptions - Global configuration options
 * @returns Validation result with errors, warnings, and skipped checks
 *
 * @example
 * ```ts
 * const result = validateExtendsGraph(graph, globalOptions)
 *
 * if (result.errors.length > 0) {
 *   console.error('Validation errors:', result.errors)
 * }
 *
 * if (result.warnings.length > 0) {
 *   console.warn('Validation warnings:', result.warnings)
 * }
 * ```
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
