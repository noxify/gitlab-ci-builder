import type {
  GlobalOptions,
  JobDefinitionNormalized,
  JobDefinitionOutput,
  JobOptions,
  ValidationError,
} from "../schema"
import { mergeJobDefinitions } from "../merge"
import { buildExtendsGraph, topologicalSort, validateExtendsGraph } from "../resolution/graph"

/**
 * Resolution context for tracking metadata during extends resolution
 */
interface ResolutionContext {
  jobOptions: Record<string, JobOptions>
  globalOptions: GlobalOptions
  errors: ValidationError[]
  warnings: ValidationError[]
  skippedChecks: string[]
}

/**
 * Resolve extends relationships for all jobs and templates.
 *
 * This function performs the core extends resolution logic:
 * 1. Builds the dependency graph
 * 2. Validates for cycles and missing targets
 * 3. Performs topological sort
 * 4. Merges job definitions following the extends chain
 *
 * @param jobs - Map of job definitions
 * @param templates - Map of template definitions
 * @param jobOptionsMap - Job-specific options
 * @param globalOptions - Global configuration options
 * @returns Resolution result with resolved jobs, errors, and warnings
 *
 * @example
 * ```ts
 * const result = resolveExtends(jobs, templates, {}, globalOptions)
 *
 * if (result.errors.length === 0) {
 *   // Use result.resolved for the final pipeline
 *   console.log(result.resolved)
 * }
 * ```
 */
export function resolveExtends(
  jobs: Record<string, JobDefinitionNormalized>,
  templates: Record<string, JobDefinitionNormalized>,
  jobOptionsMap: Record<string, JobOptions>,
  globalOptions: GlobalOptions,
): {
  resolved: Record<string, JobDefinitionOutput>
  errors: ValidationError[]
  warnings: ValidationError[]
  skippedChecks: string[]
} {
  const context: ResolutionContext = {
    jobOptions: jobOptionsMap,
    globalOptions,
    errors: [],
    warnings: [],
    skippedChecks: [],
  }

  // Build combined graph
  const graph = buildExtendsGraph(jobs, templates, jobOptionsMap)

  // Validate graph
  const validation = validateExtendsGraph(graph, globalOptions)
  context.errors.push(...validation.errors)
  context.warnings.push(...validation.warnings)
  context.skippedChecks.push(...validation.skippedChecks)

  // If there are errors, return early
  if (context.errors.length > 0) {
    return {
      resolved: {},
      errors: context.errors,
      warnings: context.warnings,
      skippedChecks: context.skippedChecks,
    }
  }

  // Topological sort to get correct merge order
  const sortedNames = topologicalSort(graph)

  // Resolve extends in topological order
  const resolved = new Map<string, JobDefinitionOutput>()
  const fullyResolved = new Map<string, JobDefinitionNormalized>()

  for (const name of sortedNames) {
    const node = graph.get(name)
    if (!node) continue

    // Check if this job should have extends resolved
    const jobOpts = context.jobOptions[name]
    const mergeExtends = jobOpts?.mergeExtends ?? globalOptions.mergeExtends
    const resolveTemplatesOnly = jobOpts?.resolveTemplatesOnly ?? globalOptions.resolveTemplatesOnly

    // Start with empty definition
    let mergedDef: JobDefinitionNormalized = {}

    // Collect all extends that should be kept (not merged)
    const keptExtends: string[] = []

    // Recursively collect non-template extends from merged templates
    const collectNonTemplateExtends = (extendName: string, visited = new Set<string>()): void => {
      if (visited.has(extendName)) return
      visited.add(extendName)

      const targetName = graph.has(extendName) ? extendName : `.${extendName}`
      const targetNode = graph.get(targetName)

      if (!targetNode?.extends) return

      for (const nestedExtend of targetNode.extends) {
        const nestedTargetName = graph.has(nestedExtend) ? nestedExtend : `.${nestedExtend}`
        const nestedNode = graph.get(nestedTargetName)

        if (!nestedNode) {
          // Unknown extend, keep it
          if (!keptExtends.includes(nestedExtend)) {
            keptExtends.push(nestedExtend)
          }
        } else if (nestedNode.isRemote) {
          // Remote extend, keep it
          if (!keptExtends.includes(nestedExtend)) {
            keptExtends.push(nestedExtend)
          }
        } else if (!nestedTargetName.startsWith(".")) {
          // Normal job (not template), keep it
          if (!keptExtends.includes(nestedExtend)) {
            keptExtends.push(nestedExtend)
          }
        } else {
          // It's a template, recurse into it
          collectNonTemplateExtends(nestedExtend, visited)
        }
      }
    }

    // Merge extends chain (ALWAYS resolve for merging, regardless of mergeExtends)
    if (node.extends.length > 0) {
      for (const extendName of node.extends) {
        // Try with and without dot prefix
        const targetName = graph.has(extendName) ? extendName : `.${extendName}`
        const targetNode = graph.get(targetName)

        if (!targetNode) {
          // Unknown target, keep in extends
          keptExtends.push(extendName)
          continue
        }

        // Check if we should merge this extend
        const shouldMerge = resolveTemplatesOnly ? targetName.startsWith(".") : true

        // Skip remote extends from merging
        if (targetNode.isRemote) {
          keptExtends.push(extendName)
          continue
        }

        if (shouldMerge) {
          // Use fully resolved definition (without extends field) for merging
          const targetDef = fullyResolved.get(targetName)
          if (targetDef) {
            mergedDef = mergeJobDefinitions(mergedDef, targetDef)
          } else {
            mergedDef = mergeJobDefinitions(mergedDef, targetNode.definition)
          }

          // If resolveTemplatesOnly and this is a template, collect non-template extends from it
          if (resolveTemplatesOnly && targetName.startsWith(".")) {
            collectNonTemplateExtends(extendName)
          }
        } else {
          // Don't merge, but keep in extends (normal job when resolveTemplatesOnly: true)
          keptExtends.push(extendName)
        }
      }
    }

    // Merge with the job's own definition (highest priority)
    const finalDef = mergeJobDefinitions(mergedDef, node.definition)

    // Store fully resolved version (for use by jobs that extend from this)
    fullyResolved.set(name, finalDef)

    // Determine what to output based on mergeExtends
    if (mergeExtends === false) {
      // Keep extends as-is in output
      resolved.set(name, node.definition)
      continue
    }

    // Add kept extends to final definition (or remove extends entirely if none kept)
    let outputDef: JobDefinitionOutput
    if (keptExtends.length > 0) {
      if (keptExtends.length === 1) {
        outputDef = { ...finalDef, extends: keptExtends[0] }
      } else {
        outputDef = { ...finalDef, extends: keptExtends }
      }
    } else {
      // Remove extends field entirely if nothing to keep
      const { extends: _extends, ...rest } = finalDef
      outputDef = rest as JobDefinitionOutput
    }

    resolved.set(name, outputDef)
  }

  // Convert Map back to Record
  const resolvedRecord: Record<string, JobDefinitionOutput> = {}
  for (const [name, def] of resolved.entries()) {
    resolvedRecord[name] = def
  }

  return {
    resolved: resolvedRecord,
    errors: context.errors,
    warnings: context.warnings,
    skippedChecks: context.skippedChecks,
  }
}
