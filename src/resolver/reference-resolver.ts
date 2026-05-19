/**
 * GitLab CI !reference tag resolver
 *
 * Resolves YAML !reference tags like:
 * tags: !reference [job_name, tags]
 *
 * to their actual values from the parsed YAML.
 */

interface ReferenceTag {
  kind: "reference"
  path: string[]
}

/**
 * Check if value is a !reference tag object.
 *
 * !reference tags are parsed from YAML as objects with `kind: "reference"`
 * and a `path` array containing the reference path segments.
 *
 * @param value - The value to check
 * @returns True if value is a ReferenceTag object
 *
 * @example
 * ```ts
 * isReferenceTag({ kind: 'reference', path: ['.job', 'script'] }) // Returns: true
 * isReferenceTag({ other: 'value' }) // Returns: false
 * ```
 */
function isReferenceTag(value: unknown): value is ReferenceTag {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "reference" &&
    "path" in value &&
    Array.isArray(value.path)
  )
}

/**
 * Resolve a single reference path to its actual value.
 *
 * Navigates through the parsed YAML object following the path segments
 * to find the referenced value.
 *
 * @param parsed - The complete parsed YAML object
 * @param path - Array of path segments to follow (e.g., ['.template', 'script'])
 * @returns The resolved value, or undefined if path doesn't exist
 *
 * @example
 * ```ts
 * const parsed = { '.template': { script: ['npm test'] } }
 * resolveReference(parsed, ['.template', 'script'])
 * // Returns: ['npm test']
 * ```
 */
function resolveReference(
  parsed: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = parsed

  for (const segment of path) {
    if (typeof current !== "object" || current === null) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

/**
 * Recursively resolve all !reference tags in a value.
 *
 * Traverses arrays, objects, and nested structures to find and resolve
 * all !reference tags. Detects and prevents circular references by
 * tracking visited paths.
 *
 * @param value - The value to process (can be any type)
 * @param parsed - The complete parsed YAML object for reference resolution
 * @param visited - Set of already visited reference paths to prevent cycles
 * @returns A new value with all !reference tags resolved to their actual values
 *
 * @example
 * ```ts
 * const parsed = { '.base': { tags: ['docker'] } }
 * const value = { tags: { kind: 'reference', path: ['.base', 'tags'] } }
 * resolveReferencesInValue(value, parsed)
 * // Returns: { tags: ['docker'] }
 * ```
 */
function resolveReferencesInValue(
  value: unknown,
  parsed: Record<string, unknown>,
  visited = new Set<string>()
): unknown {
  // Handle arrays
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const resolved = resolveReferencesInValue(item, parsed, visited)
      // Flatten arrays from !reference tags (GitLab behavior)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Array.isArray(resolved) ? resolved : [resolved]
    })
  }

  // Handle !reference tags
  if (isReferenceTag(value)) {
    const pathKey = value.path.join(".")
    if (visited.has(pathKey)) {
      // Circular reference, return as-is
      return value
    }
    visited.add(pathKey)

    const resolved = resolveReference(parsed, value.path)
    // Recursively resolve the resolved value
    return resolveReferencesInValue(resolved, parsed, visited)
  }

  // Handle objects
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveReferencesInValue(val, parsed, visited)
    }
    return result
  }

  // Return primitives as-is
  return value
}

/**
 * Resolve all !reference tags in the parsed YAML.
 *
 * GitLab CI supports !reference tags that allow you to reuse configuration
 * from other parts of the YAML file. This function resolves these references
 * to their actual values.
 *
 * @param parsed - Parsed YAML object containing !reference tags
 * @returns New object with all !reference tags resolved to their actual values
 *
 * @example
 * ```ts
 * const parsed = {
 *   '.template': { script: ['echo hello', 'echo world'] },
 *   build: { script: { kind: 'reference', path: ['.template', 'script'] } }
 * }
 *
 * const resolved = resolveReferences(parsed)
 * // resolved.build.script = ['echo hello', 'echo world']
 * ```
 *
 * @see https://docs.gitlab.com/ee/ci/yaml/yaml_optimization.html#reference-tags
 */
export function resolveReferences(
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    result[key] = resolveReferencesInValue(value, parsed)
  }

  return result
}
