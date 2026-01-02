import type { JobDefinitionNormalized } from "../schema"

/**
 * Merge strategy types
 */
export type MergeStrategy = "replace" | "concat" | "union" | "deep"

/**
 * Field-specific merge rules for GitLab CI job properties
 */
export const MERGE_RULES: Record<string, MergeStrategy> = {
  // Scripts: concat (parent first, child appended)
  script: "concat",
  before_script: "concat",
  after_script: "concat",

  // Tags: union (unique values)
  tags: "union",

  // Services: concat unique (by name)
  services: "union",

  // Variables: deep merge (child keys override parent keys)
  variables: "deep",

  // Deep merge for complex objects
  artifacts: "deep",
  cache: "deep",
  environment: "deep",
  retry: "deep",
  release: "deep",
  trigger: "deep",

  // Replace (child wins)
  stage: "replace",
  image: "replace",
  needs: "replace",
  dependencies: "replace",
  rules: "replace",
  allow_failure: "replace",
  when: "replace",
  timeout: "replace",
  parallel: "replace",
  interruptible: "replace",
  resource_group: "replace",
}

/**
 * Merge two string arrays by concatenating (parent first, child appended)
 */
function concatArrays<T>(parent: T[] | undefined, child: T[] | undefined): T[] | undefined {
  if (!parent && !child) return undefined
  if (!parent) return child
  if (!child) return parent
  return [...parent, ...child]
}

/**
 * Merge two arrays by union (unique values)
 */
function unionArrays<T>(parent: T[] | undefined, child: T[] | undefined): T[] | undefined {
  if (!parent && !child) return undefined
  if (!parent) return child
  if (!child) return parent
  return Array.from(new Set([...parent, ...child]))
}

/**
 * Deep merge two objects
 */
function deepMerge<T>(parent: T | undefined, child: T | undefined): T | undefined {
  if (!parent && !child) return undefined
  if (!parent) return child
  if (!child) return parent

  // Handle arrays
  if (Array.isArray(parent) && Array.isArray(child)) {
    return child as T // For deep merge, child array replaces parent
  }

  // Handle objects
  if (
    typeof parent === "object" &&
    typeof child === "object" &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    parent !== null &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    child !== null
  ) {
    const result: Record<string, unknown> = { ...(parent as object) } as Record<string, unknown>

    for (const [key, value] of Object.entries(child as object)) {
      if (key in result) {
        const parentValue = result[key]
        if (
          typeof parentValue === "object" &&
          parentValue !== null &&
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(parentValue) &&
          !Array.isArray(value)
        ) {
          result[key] = deepMerge(parentValue, value)
        } else {
          result[key] = value
        }
      } else {
        result[key] = value
      }
    }

    return result as T
  }

  return child
}

/**
 * Merge two job definitions using field-specific strategies.
 *
 * Applies GitLab CI merge semantics for job inheritance:
 * - Scripts: concatenate (parent first, child appended)
 * - Tags/Services: union (unique values only)
 * - Variables/Artifacts/Cache: deep merge
 * - Most other fields: child overrides parent
 *
 * @param parent - Parent job definition
 * @param child - Child job definition
 * @returns Merged job definition
 *
 * @example
 * ```ts
 * const parent = {
 *   script: ['npm ci'],
 *   variables: { NODE_ENV: 'production' }
 * }
 *
 * const child = {
 *   script: ['npm test'],
 *   variables: { DEBUG: 'true' }
 * }
 *
 * const merged = mergeJobDefinitions(parent, child)
 * // Result:
 * // {
 * //   script: ['npm ci', 'npm test'],
 * //   variables: { NODE_ENV: 'production', DEBUG: 'true' }
 * // }
 * ```
 *
 * @see https://docs.gitlab.com/ee/ci/yaml/#extends
 */
export function mergeJobDefinitions(
  parent: JobDefinitionNormalized,
  child: JobDefinitionNormalized,
): JobDefinitionNormalized {
  const result: Record<string, unknown> = {}

  // Collect all keys from both parent and child
  const allKeys = new Set([...Object.keys(parent), ...Object.keys(child)])

  for (const key of allKeys) {
    const parentValue = parent[key as keyof JobDefinitionNormalized]
    const childValue = child[key as keyof JobDefinitionNormalized]

    // Get merge strategy for this field
    const strategy = MERGE_RULES[key] ?? "replace"

    switch (strategy) {
      case "concat":
        if (Array.isArray(parentValue) || Array.isArray(childValue)) {
          result[key] = concatArrays(
            parentValue as unknown[] | undefined,
            childValue as unknown[] | undefined,
          )
        } else {
          // For non-array values (like single strings), convert to arrays and concat
          const parentArray = parentValue
            ? Array.isArray(parentValue)
              ? parentValue
              : [parentValue]
            : undefined
          const childArray = childValue
            ? Array.isArray(childValue)
              ? childValue
              : [childValue]
            : undefined
          result[key] = concatArrays(parentArray, childArray)
        }
        break

      case "union":
        if (key === "services") {
          // Services: union by service name
          result[key] = mergeServices(
            parentValue as JobDefinitionNormalized["services"],
            childValue as JobDefinitionNormalized["services"],
          )
        } else {
          result[key] = unionArrays(
            parentValue as unknown[] | undefined,
            childValue as unknown[] | undefined,
          )
        }
        break

      case "deep":
        result[key] = deepMerge(parentValue, childValue)
        break

      case "replace":
      default:
        result[key] = childValue ?? parentValue
        break
    }
  }

  return result as JobDefinitionNormalized
}

/**
 * Merge services with union by name
 */
function mergeServices(
  parent: JobDefinitionNormalized["services"],
  child: JobDefinitionNormalized["services"],
): JobDefinitionNormalized["services"] {
  if (!parent && !child) return undefined
  if (!parent) return child
  if (!child) return parent

  // Helper to get service name, handling nested arrays
  const getServiceName = (service: (typeof parent)[number]): string => {
    if (typeof service === "string") return service
    if (Array.isArray(service)) {
      // Nested array: extract first element
      const first = service[0] as unknown
      if (typeof first === "string") return first
      if (typeof first === "object" && first && "name" in first) {
        return String((first as { name: string }).name)
      }
      return "unknown"
    }
    return service.name
  }

  const serviceMap = new Map<string, (typeof parent)[number]>()

  // Add parent services
  for (const service of parent) {
    const name = getServiceName(service)
    serviceMap.set(name, service)
  }

  // Add/override with child services
  for (const service of child) {
    const name = getServiceName(service)
    serviceMap.set(name, service)
  }

  return Array.from(serviceMap.values())
}

/**
 * Merge variables (child overrides parent keys).
 *
 * Performs a shallow merge where child variable values override parent values
 * for matching keys, while keeping unique keys from both.
 *
 * @param parent - Parent variables
 * @param child - Child variables
 * @returns Merged variables object
 *
 * @example
 * ```ts
 * const parent = { NODE_ENV: 'production', VERSION: '1.0' }
 * const child = { NODE_ENV: 'development', DEBUG: 'true' }
 *
 * const merged = mergeVariables(parent, child)
 * // Result: { NODE_ENV: 'development', VERSION: '1.0', DEBUG: 'true' }
 * ```
 */
export function mergeVariables(
  parent: JobDefinitionNormalized["variables"],
  child: JobDefinitionNormalized["variables"],
): JobDefinitionNormalized["variables"] {
  if (!parent && !child) return undefined
  if (!parent) return child
  if (!child) return parent
  return { ...parent, ...child }
}
