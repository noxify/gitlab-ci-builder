import { CORE_SCHEMA, defineSequenceTag, dump } from "js-yaml"

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
const referenceTag = defineSequenceTag<unknown[], unknown[]>("!reference", {
  create: () => [],
  addItem: (carrier, item) => {
    carrier.push(item)
  },
  identify: (obj: unknown) => obj instanceof FlowArray,
  represent: (obj: unknown) => obj as ArrayLike<unknown>,
})

const CUSTOM_SCHEMA = CORE_SCHEMA.withTags(referenceTag)

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
    const match = /^!reference\s*\[(?<content>[^\]]+)\]$/u.exec(value)
    if (match?.groups?.content) {
      const parts = match.groups.content.split(",").map((s) => s.trim())
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
      .toSorted()
    const regularJobs = Object.keys(jobs)
      .filter((k) => !k.startsWith("."))
      .toSorted()

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
    const arrayRefResult = tryProcessArrayReference(lines, i, line)
    if (arrayRefResult) {
      resultLines.push(arrayRefResult.output)
      i += arrayRefResult.skip
      continue
    }

    // Case 2: Check if this line contains a scalar !reference (e.g., "image: !reference")
    const scalarRefResult = tryProcessScalarReference(lines, i, line)
    if (scalarRefResult) {
      resultLines.push(scalarRefResult.output)
      i += scalarRefResult.skip
      continue
    }

    if (line !== undefined) {
      resultLines.push(line)
    }
    i += 1
  }

  return resultLines.join("\n")
}

function tryProcessArrayReference(
  lines: string[],
  i: number,
  line: string | undefined
): { output: string; skip: number } | null {
  if (line?.trim() !== "- !reference") {
    return null
  }

  const nextLine1 = lines[i + 1]
  const nextLine2 = lines[i + 2]

  if (
    !nextLine1 ||
    !nextLine2 ||
    !nextLine1.trim().startsWith("- ") ||
    !nextLine2.trim().startsWith("- ")
  ) {
    return null
  }

  const elem1 = nextLine1.trim().slice(2)
  const elem2 = nextLine2.trim().slice(2)

  const indentMatch = /^(?<indent>\s*)/u.exec(line)
  const indent = indentMatch?.groups?.indent ?? ""

  return { output: `${indent}- !reference [${elem1}, ${elem2}]`, skip: 3 }
}

function tryProcessScalarReference(
  lines: string[],
  i: number,
  line: string | undefined
): { output: string; skip: number } | null {
  if (!line?.includes(": !reference")) {
    return null
  }

  const nextLine1 = lines[i + 1]
  const nextLine2 = lines[i + 2]

  if (
    !nextLine1 ||
    !nextLine2 ||
    !nextLine1.trim().startsWith("- ") ||
    !nextLine2.trim().startsWith("- ")
  ) {
    return null
  }

  const elem1 = nextLine1.trim().slice(2)
  const elem2 = nextLine2.trim().slice(2)

  const keyMatch = /^(?<indent>\s*)(?<key>.+):\s*!reference\s*$/u.exec(line)
  if (!keyMatch) {
    return null
  }

  const { indent = "", key } = keyMatch.groups ?? {}
  return { output: `${indent}${key}: !reference [${elem1}, ${elem2}]`, skip: 3 }
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
 * Serialize a pipeline configuration to a GitLab CI YAML string.
 *
 * This function converts a PipelineOutput object into a properly formatted
 * GitLab CI YAML configuration string with:
 * - Canonical key ordering (workflow, include, default, variables, stages, jobs)
 * - Templates listed before regular jobs
 * - Proper !reference tag formatting
 * - Blank lines between sections for readability
 * - Empty sections automatically omitted
 *
 * @param pipeline - The pipeline configuration to serialize
 * @returns Formatted GitLab CI YAML string
 *
 * @example
 * ```ts
 * import { serializeToYaml } from '@noxify/gitlab-ci-builder'
 *
 * const pipeline = {
 *   stages: ['build', 'test'],
 *   variables: { NODE_ENV: 'production' },
 *   jobs: {
 *     '.base': { image: 'node:22' },
 *     'build': {
 *       extends: '.base',
 *       stage: 'build',
 *       script: ['npm run build']
 *     }
 *   }
 * }
 *
 * const yaml = serializeToYaml(pipeline)
 * console.log(yaml)
 * // Output:
 * // stages:
 * //   - build
 * //   - test
 * //
 * // variables:
 * //   NODE_ENV: production
 * //
 * // .base:
 * //   image: node:22
 * //
 * // build:
 * //   extends: .base
 * //   stage: build
 * //   script:
 * //     - npm run build
 * ```
 */
export function serializeToYaml(pipeline: PipelineOutput): string {
  // Process references before serialization
  const processed = processReferences(pipeline) as PipelineOutput

  // Order keys for consistent output
  const ordered = orderPipelineKeys(processed)

  // Dump to YAML
  let yamlString = dump(ordered, {
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
