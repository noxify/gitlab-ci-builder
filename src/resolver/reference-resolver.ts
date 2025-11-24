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
 * Check if value is a !reference tag object
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
 * Resolve a single reference path
 */
function resolveReference(parsed: Record<string, unknown>, path: string[]): unknown {
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
 * Recursively resolve all !reference tags in an object
 */
function resolveReferencesInValue(
  value: unknown,
  parsed: Record<string, unknown>,
  visited = new Set<string>(),
): unknown {
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => resolveReferencesInValue(item, parsed, visited))
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
 * Resolve all !reference tags in the parsed YAML
 *
 * @param parsed - Parsed YAML object
 * @returns New object with all !reference tags resolved
 */
export function resolveReferences(parsed: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    result[key] = resolveReferencesInValue(value, parsed)
  }

  return result
}
