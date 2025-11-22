import type {
  GlobalOptions,
  JobDefinitionNormalized,
  JobDefinitionOutput,
  JobOptions,
  ValidationError,
} from "../schema"
import { mergeJobDefinitions } from "../merge"
import { buildExtendsGraph, topologicalSort, validateExtendsGraph } from "./graph"

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
 * Resolve extends for all jobs and templates
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
  const graph = buildExtendsGraph(jobs, templates)

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

  for (const name of sortedNames) {
    const node = graph.get(name)
    if (!node) continue

    // Check if this job should have extends resolved
    const jobOpts = context.jobOptions[name]
    const mergeExtends = jobOpts?.mergeExtends ?? globalOptions.mergeExtends
    const resolveTemplatesOnly = jobOpts?.resolveTemplatesOnly ?? globalOptions.resolveTemplatesOnly

    if (mergeExtends === false) {
      // Keep extends as-is
      resolved.set(name, node.definition)
      continue
    }

    // Start with empty definition
    let mergedDef: JobDefinitionNormalized = {}

    // Merge extends chain
    if (node.extends.length > 0) {
      for (const extendName of node.extends) {
        // Try with and without dot prefix
        const targetName = graph.has(extendName) ? extendName : `.${extendName}`
        const targetNode = graph.get(targetName)

        if (!targetNode) continue

        // Check if we should merge this extend
        const shouldMerge = resolveTemplatesOnly ? targetName.startsWith(".") : true

        // Skip remote extends
        if (targetNode.isRemote) continue

        if (shouldMerge) {
          // Get the resolved definition (or use original if not yet resolved)
          const targetDef = resolved.get(targetName)
          if (targetDef) {
            // Convert back to normalized form for merging
            const normalizedTarget: JobDefinitionNormalized = {
              ...targetDef,
              extends: Array.isArray(targetDef.extends)
                ? targetDef.extends
                : targetDef.extends
                  ? [targetDef.extends]
                  : undefined,
            }
            mergedDef = mergeJobDefinitions(mergedDef, normalizedTarget)
          } else {
            mergedDef = mergeJobDefinitions(mergedDef, targetNode.definition)
          }
        }
      }
    }

    // Merge with the job's own definition (highest priority)
    const finalDef = mergeJobDefinitions(mergedDef, node.definition)

    // Clean up extends field
    const cleanedDef = cleanExtendsField(finalDef, node, graph, globalOptions, jobOpts)

    resolved.set(name, cleanedDef)
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

/**
 * Clean extends field after resolution
 * Remove local extends, keep only remote/external ones
 */
function cleanExtendsField(
  definition: JobDefinitionNormalized,
  node: { extends: string[]; isRemote: boolean },
  graph: Map<string, { isRemote: boolean }>,
  globalOptions: GlobalOptions,
  jobOpts?: JobOptions,
): JobDefinitionOutput {
  const mergeExtends = jobOpts?.mergeExtends ?? globalOptions.mergeExtends

  if (mergeExtends === false) {
    // Keep extends as-is, just optimize to string if single entry
    if (definition.extends?.length === 1) {
      return {
        ...definition,
        extends: definition.extends[0],
      } as JobDefinitionOutput
    }
    return definition as JobDefinitionOutput
  }

  // Filter extends to keep only remote/external ones
  if (definition.extends && definition.extends.length > 0) {
    const filtered = definition.extends.filter((extendName) => {
      const targetName = graph.has(extendName) ? extendName : `.${extendName}`
      const targetNode = graph.get(targetName)

      // Keep if remote or not found in local graph
      return !targetNode || targetNode.isRemote
    })

    if (filtered.length === 0) {
      // Remove extends field entirely
      const { extends: _extends, ...rest } = definition
      return rest as JobDefinitionOutput
    }

    if (filtered.length === 1) {
      // Optimize to string
      return {
        ...definition,
        extends: filtered[0],
      } as JobDefinitionOutput
    }

    // Keep as array
    return {
      ...definition,
      extends: filtered,
    } as JobDefinitionOutput
  }

  return definition as JobDefinitionOutput
}
