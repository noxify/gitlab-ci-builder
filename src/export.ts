import fs from "fs/promises"
import yaml from "js-yaml"

import type { GitLabCi } from "./"

// Wrapper class to mark arrays that should be rendered in flow style
class FlowArray<T = unknown> extends Array<T> {
  constructor(...items: T[]) {
    super()
    this.push(...items)
  }
}

// Custom YAML type for !reference tags
const referenceTag = new yaml.Type("!reference", {
  kind: "sequence",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  construct: (data) => data,
  predicate: (obj) => {
    return obj instanceof FlowArray
  },
  represent: (obj: unknown) => {
    return obj
  },
  instanceOf: FlowArray,
})

const CUSTOM_SCHEMA = yaml.DEFAULT_SCHEMA.extend({ explicit: [referenceTag] })

/**
 * Process a value to convert !reference strings to proper arrays
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
 * Convert a plain `GitLabCi` object to a YAML string.
 *
 * @param config - The YAML-serializable `GitLabCi` object produced by `getPlainObject()`.
 * @returns YAML string representation of the pipeline.
 */
export function toYaml(config: GitLabCi) {
  // Process references before serialization
  const processed = processReferences(config) as GitLabCi

  const { jobs, ...rest } = processed

  // Define preferred order for top-level keys
  const keyOrder = [
    "workflow",
    "include",
    "default",
    "variables",
    "stages",

    // Jobs come after
  ]

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

  const yamlString = yaml.dump(ordered, {
    noRefs: true,
    sortKeys: false,
    lineWidth: -1,
    schema: CUSTOM_SCHEMA,
  })

  // Post-process to convert multiline !reference to inline format
  const lines = yamlString.split("\n")
  const resultLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Check if this line contains a multiline !reference tag
    if (line && line.trim() === "- !reference") {
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

    if (line !== undefined) {
      resultLines.push(line)
    }
    i++
  }

  const processedYaml = resultLines.join("\n")

  // Add blank lines between top-level sections for better readability
  const finalLines = processedYaml.split("\n")
  const outputLines: string[] = []
  let lastTopLevelKey: string | null = null
  let previousLineWasValue = false

  for (const line of finalLines) {
    const trimmed = line.trim()

    // Check if this is a top-level key (no indentation and ends with :)
    if (trimmed && !line.startsWith(" ") && trimmed.endsWith(":")) {
      const key = trimmed.slice(0, -1)

      // Add blank line before this top-level key if:
      // 1. We had a previous top-level key, AND
      // 2. The previous line was part of that key's value (not empty)
      if (lastTopLevelKey !== null && previousLineWasValue) {
        resultLines.push("")
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
 * Write a `GitLabCi` plain object to a YAML file.
 *
 * @param filePath - Destination file path for the YAML output.
 * @param config - The plain `GitLabCi` object to serialize.
 * @param options - Optional write options (currently only `encoding`).
 */
export async function writeYamlFile(
  filePath: string,
  config: GitLabCi,
  options?: { encoding?: BufferEncoding },
) {
  const content = toYaml(config)
  await fs.writeFile(filePath, content, { encoding: options?.encoding ?? "utf8" })
}

export default { toYaml, writeYamlFile }
