import fs from "fs/promises"
import yaml from "js-yaml"

import type { GitLabCi } from "."

/**
 * Convert a plain `GitLabCi` object to a YAML string.
 *
 * @param config - The YAML-serializable `GitLabCi` object produced by `getPlainObject()`.
 * @returns YAML string representation of the pipeline.
 */
export function toYaml(config: GitLabCi) {
  const { jobs, ...rest } = config

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

  const yamlString = yaml.dump(ordered, { noRefs: true, sortKeys: false, lineWidth: -1 })

  // Add blank lines between top-level sections for better readability
  const lines = yamlString.split("\n")
  const resultLines: string[] = []
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
        resultLines.push("")
      }

      lastTopLevelKey = key
      previousLineWasValue = false
    } else if (trimmed) {
      // This is a value line (indented or continuation)
      previousLineWasValue = true
    }

    resultLines.push(line)
  }

  return resultLines.join("\n")
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
