import { mergeJobDefinitions } from "../merge"
import {
  buildExtendsGraph,
  topologicalSort,
  validateExtendsGraph,
} from "../resolution/graph"
import type { ExtendsGraphNode } from "../resolution/graph"
import type { ValidationError } from "../schema/errors"
import type {
  JobDefinitionNormalized,
  JobDefinitionOutput,
} from "../schema/job"
import type { GlobalOptions, JobOptions } from "../schema/policies"

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
  globalOptions: GlobalOptions
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
    resolveNodeExtends(name, graph, context, fullyResolved, resolved)
  }

  return {
    resolved: mapToRecord(resolved),
    errors: context.errors,
    warnings: context.warnings,
    skippedChecks: context.skippedChecks,
  }
}

function resolveNodeExtends(
  name: string,
  graph: Map<string, ExtendsGraphNode>,
  context: ResolutionContext,
  fullyResolved: Map<string, JobDefinitionNormalized>,
  resolved: Map<string, JobDefinitionOutput>
): void {
  const node = graph.get(name)
  if (!node) {
    return
  }

  const options = getEffectiveOptions(name, context)
  const mergeResult = mergeExtendsChain(
    node,
    graph,
    fullyResolved,
    options.resolveTemplatesOnly,
    options.mergeRemoteExtends
  )

  const finalDef = mergeJobDefinitions(mergeResult.mergedDef, node.definition)
  fullyResolved.set(name, finalDef)

  if (!options.mergeExtends) {
    resolved.set(name, node.definition)
    return
  }

  resolved.set(name, buildOutputDefinition(finalDef, mergeResult.keptExtends))
}

function getEffectiveOptions(
  name: string,
  context: ResolutionContext
): {
  mergeExtends: boolean
  resolveTemplatesOnly: boolean
  mergeRemoteExtends: boolean
} {
  const jobOpts = context.jobOptions[name]

  return {
    mergeExtends: jobOpts?.mergeExtends ?? context.globalOptions.mergeExtends,
    resolveTemplatesOnly:
      jobOpts?.resolveTemplatesOnly ??
      context.globalOptions.resolveTemplatesOnly,
    mergeRemoteExtends: context.globalOptions.mergeRemoteExtends,
  }
}

function mergeExtendsChain(
  node: ExtendsGraphNode,
  graph: Map<string, ExtendsGraphNode>,
  fullyResolved: Map<string, JobDefinitionNormalized>,
  resolveTemplatesOnly: boolean,
  mergeRemoteExtends: boolean
): {
  mergedDef: JobDefinitionNormalized
  keptExtends: string[]
} {
  let mergedDef: JobDefinitionNormalized = {}
  const keptExtends: string[] = []

  for (const extendName of node.extends) {
    const target = getTarget(graph, extendName)
    if (!target) {
      pushUnique(keptExtends, extendName)
      continue
    }

    const shouldMerge =
      (!resolveTemplatesOnly || target.name.startsWith(".")) &&
      (!target.node.isRemote || mergeRemoteExtends)

    if (!shouldMerge) {
      pushUnique(keptExtends, extendName)
      continue
    }

    const targetDef = fullyResolved.get(target.name) ?? target.node.definition
    mergedDef = mergeJobDefinitions(mergedDef, targetDef)

    if (resolveTemplatesOnly && target.name.startsWith(".")) {
      collectNonTemplateExtends(
        graph,
        extendName,
        keptExtends,
        mergeRemoteExtends
      )
    }
  }

  return { mergedDef, keptExtends }
}

function collectNonTemplateExtends(
  graph: Map<string, ExtendsGraphNode>,
  extendName: string,
  keptExtends: string[],
  mergeRemoteExtends: boolean,
  visited = new Set<string>()
): void {
  if (visited.has(extendName)) {
    return
  }
  visited.add(extendName)

  const target = getTarget(graph, extendName)
  if (!target?.node.extends) {
    return
  }

  for (const nestedExtend of target.node.extends) {
    const nestedTarget = getTarget(graph, nestedExtend)

    if (
      !nestedTarget ||
      (nestedTarget.node.isRemote && !mergeRemoteExtends) ||
      !nestedTarget.name.startsWith(".")
    ) {
      pushUnique(keptExtends, nestedExtend)
      continue
    }

    collectNonTemplateExtends(
      graph,
      nestedExtend,
      keptExtends,
      mergeRemoteExtends,
      visited
    )
  }
}

function getTarget(
  graph: Map<string, ExtendsGraphNode>,
  extendName: string
): { name: string; node: ExtendsGraphNode } | null {
  const targetName = graph.has(extendName) ? extendName : `.${extendName}`
  const targetNode = graph.get(targetName)

  if (!targetNode) {
    return null
  }

  return { name: targetName, node: targetNode }
}

function buildOutputDefinition(
  finalDef: JobDefinitionNormalized,
  keptExtends: readonly string[]
): JobDefinitionOutput {
  if (keptExtends.length === 0) {
    const { extends: _extends, ...rest } = finalDef
    return rest as JobDefinitionOutput
  }

  if (keptExtends.length === 1) {
    return { ...finalDef, extends: keptExtends[0] }
  }

  return { ...finalDef, extends: [...keptExtends] }
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value)
  }
}

function mapToRecord(
  resolved: Map<string, JobDefinitionOutput>
): Record<string, JobDefinitionOutput> {
  const resolvedRecord: Record<string, JobDefinitionOutput> = {}
  for (const [name, def] of resolved.entries()) {
    resolvedRecord[name] = def
  }
  return resolvedRecord
}
