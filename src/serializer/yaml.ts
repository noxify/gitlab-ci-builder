import yaml from "js-yaml"

import type { PipelineOutput } from "../model"

/**
 * Wrapper class to mark arrays that should be rendered in flow style
 * Used for !reference tags
 */
class FlowArray<T = unknown> extends Array<T> {
  constructor(...items: T[]) {
    super()
    this.push(...items)
  }
}

/**
 * Custom YAML type for !reference tags
 */
const referenceTag = new yaml.Type("!reference", {
  kind: "sequence",
  construct: (data: unknown) => data,
  predicate: (obj: unknown) => obj instanceof FlowArray,
  represent: (obj: unknown) => obj,
  instanceOf: FlowArray,
})

const CUSTOM_SCHEMA = yaml.DEFAULT_SCHEMA.extend({ explicit: [referenceTag] })

/**
 * Process a value to convert !reference strings to proper FlowArray format.
 *
 * Recursively traverses the value tree and converts string representations
 * of !reference tags (e.g., "!reference [.template, script]") into FlowArray
 * instances that will be serialized correctly by the custom YAML schema.
 *
 * @param value - The value to process (can be any type)
 * @returns Processed value with !reference strings converted to FlowArray
 *
 * @example
 * ```ts
 * processReferences({ script: '!reference [.base, script]' })
 * // Returns: { script: FlowArray('.base', 'script') }
 *
 * processReferences(['npm test', '!reference [.base, vars]'])
 * // Returns: ['npm test', FlowArray('.base', 'vars')]
 * ```
 */
function processReferences(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("!reference [")) {
    // Parse "!reference [.template, script]" into FlowArray format
    const match = /^!reference\s*\[([^\]]+)\]$/.exec(value)
    if (match?.[1]) {
      const parts = match[1].split(",").map((s) => s.trim())
      if (parts.length === 2) {
        return new FlowArray(...parts)
      }
    }
  }

  if (Array.isArray(value)) {
    return value.map(processReferences)
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = processReferences(val)
    }
    return result
  }

  return value
}

/**
 * Order keys in a pipeline output for consistent YAML formatting.
 *
 * Applies a canonical ordering to pipeline configuration keys:
 * 1. Top-level keys in preferred order: workflow, include, default, variables, stages
 * 2. Any other top-level keys not in the preferred order
 * 3. Jobs section with templates first (starting with .), then regular jobs
 * 4. Within each job group, keys are sorted alphabetically
 *
 * This ensures GitLab CI YAML files have a predictable, readable structure.
 *
 * @param pipeline - The pipeline output to order
 * @returns New object with keys in canonical order
 *
 * @example
 * ```ts
 * orderPipelineKeys({
 *   jobs: { 'test': {...}, '.template': {...}, 'build': {...} },
 *   stages: ['build', 'test'],
 *   workflow: {...}
 * })
 * // Returns: { workflow, stages, .template, build, test }
 * ```
 */
function orderPipelineKeys(pipeline: PipelineOutput): Record<string, unknown> {
  const { jobs, ...rest } = pipeline

  // Define preferred order for top-level keys
  const keyOrder = ["workflow", "include", "default", "variables", "stages"]

  // Build ordered object
  const ordered: Record<string, unknown> = {}

  // Add top-level keys in preferred order
  for (const key of keyOrder) {
    if (key in rest) {
      ordered[key] = rest[key as keyof typeof rest]
    }
  }

  // Add any remaining top-level keys that weren't in the order list
  for (const key in rest) {
    if (!keyOrder.includes(key)) {
      ordered[key] = rest[key as keyof typeof rest]
    }
  }

  // Add jobs (templates first, then regular jobs, both sorted alphabetically)
  if (jobs) {
    const templates = Object.keys(jobs)
      .filter((k) => k.startsWith("."))
      .sort()
    const regularJobs = Object.keys(jobs)
      .filter((k) => !k.startsWith("."))
      .sort()

    for (const key of [...templates, ...regularJobs]) {
      ordered[key] = jobs[key]
    }
  }

  return ordered
}

/**
 * Post-process YAML to convert multiline !reference to inline format.
 *
 * The js-yaml library serializes !reference tags in multi-line format:
 * ```yaml
 * - !reference
 *   - .template
 *   - script
 * ```
 *
 * This function converts them to GitLab's inline format:
 * ```yaml
 * - !reference [.template, script]
 * ```
 *
 * Handles both array contexts and scalar contexts (e.g., `image: !reference [...]`).
 *
 * @param yamlString - The YAML string to post-process
 * @returns YAML string with !reference tags in inline format
 *
 * @example
 * ```ts
 * postProcessReferences('script:\n  - !reference\n    - .base\n    - script')
 * // Returns: 'script:\n  - !reference [.base, script]'
 * ```
 */
function postProcessReferences(yamlString: string): string {
  const lines = yamlString.split("\n")
  const resultLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Case 1: Check if this line contains a multiline !reference tag in an array
    if (line?.trim() === "- !reference") {
      // Next two lines should contain the array elements
      const nextLine1 = lines[i + 1]
      const nextLine2 = lines[i + 2]

      if (
        nextLine1 &&
        nextLine2 &&
        nextLine1.trim().startsWith("- ") &&
        nextLine2.trim().startsWith("- ")
      ) {
        const elem1 = nextLine1.trim().slice(2)
        const elem2 = nextLine2.trim().slice(2)

        // Get the indentation from the original "- !reference" line
        const match = /^(\s*)/.exec(line)
        const indent = match?.[1] ?? ""

        // Create inline format
        resultLines.push(`${indent}- !reference [${elem1}, ${elem2}]`)

        // Skip the next two lines
        i += 3
        continue
      }
    }

    // Case 2: Check if this line contains a scalar !reference (e.g., "image: !reference")
    if (line?.includes(": !reference")) {
      // Next two lines should contain the array elements
      const nextLine1 = lines[i + 1]
      const nextLine2 = lines[i + 2]

      if (
        nextLine1 &&
        nextLine2 &&
        nextLine1.trim().startsWith("- ") &&
        nextLine2.trim().startsWith("- ")
      ) {
        const elem1 = nextLine1.trim().slice(2)
        const elem2 = nextLine2.trim().slice(2)

        // Get the key part (e.g., "image:")
        const keyMatch = /^(\s*)(.+):\s*!reference\s*$/.exec(line)
        if (keyMatch) {
          const indent = keyMatch[1] ?? ""
          const key = keyMatch[2]

          // Create inline format
          resultLines.push(`${indent}${key}: !reference [${elem1}, ${elem2}]`)

          // Skip the next two lines
          i += 3
          continue
        }
      }
    }

    if (line !== undefined) {
      resultLines.push(line)
    }
    i++
  }

  return resultLines.join("\n")
}

/**
 * Add blank lines between top-level sections for better readability.
 *
 * Inserts blank lines between major sections (workflow, stages, jobs, etc.)
 * to improve visual separation and readability of the generated YAML.
 *
 * Only adds separators between actual sections with content, avoiding
 * excessive blank lines.
 *
 * @param yamlString - The YAML string to format
 * @returns YAML string with section separators added
 *
 * @example
 * ```ts
 * addSectionSeparators('workflow:\n  rules: []\nstages:\n  - build')
 * // Returns: 'workflow:\n  rules: []\n\nstages:\n  - build'
 * ```
 */
function addSectionSeparators(yamlString: string): string {
  const lines = yamlString.split("\n")
  const outputLines: string[] = []
  let lastTopLevelKey: string | null = null
  let previousLineWasValue = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check if this is a top-level key (no indentation and ends with :)
    if (trimmed && !line.startsWith(" ") && trimmed.endsWith(":")) {
      const key = trimmed.slice(0, -1)

      // Add blank line before this top-level key if:
      // 1. We had a previous top-level key, AND
      // 2. The previous line was part of that key's value (not empty)
      if (lastTopLevelKey !== null && previousLineWasValue) {
        outputLines.push("")
      }

      lastTopLevelKey = key
      previousLineWasValue = false
    } else if (trimmed) {
      // This is a value line (indented or continuation)
      previousLineWasValue = true
    }

    outputLines.push(line)
  }

  return outputLines.join("\n")
}

/**
 * Serialize a pipeline configuration to YAML string
 *
 * @param pipeline - The pipeline configuration to serialize
 * @returns YAML string representation
 */
export function serializeToYaml(pipeline: PipelineOutput): string {
  // Process references before serialization
  const processed = processReferences(pipeline) as PipelineOutput

  // Order keys for consistent output
  const ordered = orderPipelineKeys(processed)

  // Dump to YAML
  let yamlString = yaml.dump(ordered, {
    noRefs: true,
    sortKeys: false,
    lineWidth: -1,
    schema: CUSTOM_SCHEMA,
  })

  // Post-process !reference tags
  yamlString = postProcessReferences(yamlString)

  // Add section separators
  yamlString = addSectionSeparators(yamlString)

  return yamlString
}
