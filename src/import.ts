import fs from "fs/promises"
import yaml from "js-yaml"

// Custom GitLab CI tag: !reference [.template, script]
// js-yaml does not know this tag by default, so we map it to a string literal
// so that downstream formatting treats it like a regular script line.
const referenceTag = new yaml.Type("!reference", {
  kind: "sequence",
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  construct: (data: unknown[]) => `!reference [${(data || []).join(", ")}]`,
})

// Extend default schema to include the custom tag while retaining standard types.
const CUSTOM_SCHEMA = yaml.DEFAULT_SCHEMA.extend({ explicit: [referenceTag] })

/**
 * Options for converting YAML to TypeScript
 */
export interface ImportOptions {
  /**
   * Generate extended config with type-only import and function-based export.
   * When true:
   * - Uses `import type { Config }` instead of `import { Config }`
   * - Exports a function that receives and returns a Config instance
   * @default false
   */
  asExtendedConfig?: boolean
}

/**
 * Convert a GitLab CI YAML string to TypeScript Config builder code.
 *
 * @param yamlContent - The YAML string to parse and convert.
 * @param options - Optional configuration for the conversion.
 * @returns TypeScript code as a string that uses the Config builder API.
 */
export function fromYaml(yamlContent: string, options?: ImportOptions): string {
  const parsed = yaml.load(yamlContent, { schema: CUSTOM_SCHEMA }) as Record<string, unknown>
  const asExtended = options?.asExtendedConfig ?? false

  const lines: string[] = []

  // Import statement
  if (asExtended) {
    lines.push('import type { Config } from "@noxify/gitlab-ci-builder"')
  } else {
    lines.push('import { Config } from "@noxify/gitlab-ci-builder"')
  }
  lines.push("")

  // Function wrapper or direct config
  if (asExtended) {
    lines.push("export default function (config: Config) {")
  } else {
    lines.push("const config = new Config()")
  }
  lines.push("")

  // Known top-level keys in GitLab CI
  const knownTopLevelKeys = [
    "stages",
    "workflow",
    "include",
    "variables",
    "default",
    "image",
    "services",
    "before_script",
    "after_script",
    "cache",
  ]

  // Separate top-level config from jobs
  const jobs: Record<string, unknown> = {}
  const topLevel: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (knownTopLevelKeys.includes(key)) {
      topLevel[key] = value
    } else {
      jobs[key] = value
    }
  }

  // Helper to add line with proper indentation
  const addLine = (line: string) => {
    if (asExtended && line.trim() !== "") {
      // For multi-line values, indent each line
      if (line.includes("\n")) {
        const splitLines = line.split("\n")
        const indentedLines = splitLines.map((l, idx) => {
          // Don't indent the first line (it's already handled by the prefix)
          // But indent all subsequent lines
          if (idx === 0) return `  ${l}`
          return l.trim() === "" ? "" : `  ${l}`
        })
        lines.push(indentedLines.join("\n"))
      } else {
        lines.push(`  ${line}`)
      }
    } else {
      lines.push(line)
    }
  }

  // Stages
  if (topLevel.stages && Array.isArray(topLevel.stages) && topLevel.stages.length > 0) {
    addLine(`config.stages(${topLevel.stages.map((s) => JSON.stringify(s)).join(", ")})`)
    addLine("")
  }

  // Workflow
  if (topLevel.workflow) {
    addLine(`config.workflow(${formatValue(topLevel.workflow, 1, asExtended)})`)
    addLine("")
  }

  // Include
  if (topLevel.include && Array.isArray(topLevel.include) && topLevel.include.length > 0) {
    for (const inc of topLevel.include) {
      addLine(`config.include(${formatValue(inc, 1, asExtended)})`)
    }
    addLine("")
  }

  // Variables
  if (topLevel.variables && typeof topLevel.variables === "object") {
    addLine("config.variables({")
    for (const [key, value] of Object.entries(topLevel.variables as Record<string, unknown>)) {
      addLine(`  ${JSON.stringify(key)}: ${formatValue(value, 1, asExtended)},`)
    }
    addLine("})")
    addLine("")
  }

  // Default
  if (topLevel.default) {
    addLine(`config.defaults(${formatValue(topLevel.default, 1, asExtended)})`)
    addLine("")
  }

  // Jobs (separate templates and regular jobs)
  // Filter out anchor-only definitions (non-object values like arrays or strings)
  const isValidJobDefinition = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  const templateKeys = Object.keys(jobs).filter(
    (k) => k.startsWith(".") && isValidJobDefinition(jobs[k]),
  )
  const jobKeys = Object.keys(jobs).filter(
    (k) => !k.startsWith(".") && isValidJobDefinition(jobs[k]),
  )

  // Templates first
  for (const key of templateKeys) {
    const job = jobs[key]
    if (job) {
      addLine(`config.template(${JSON.stringify(key)}, ${formatValue(job, 1, asExtended)})`)
      addLine("")
    }
  }

  // Regular jobs
  for (const key of jobKeys) {
    const job = jobs[key]
    if (job) {
      addLine(`config.job(${JSON.stringify(key)}, ${formatValue(job, 1, asExtended)})`)
      addLine("")
    }
  }

  // Export statement
  if (asExtended) {
    lines.push("")
    lines.push("  return config")
    lines.push("}")
  } else {
    lines.push("export default config")
  }

  return lines.join("\n")
}

/**
 * Format script values (script, before_script, after_script) intelligently.
 *
 * Detects shell-specific patterns and formats accordingly:
 * - Line continuations (\) → Template literal
 * - Heredoc (<<) → Template literal
 * - Shell operators (|, >, >>, 2>, &>, <) → Template literal
 * - Simple multi-line commands → Array of strings
 * - Single line → String
 */
function formatScriptValue(value: unknown): string {
  if (typeof value !== "string") {
    return formatValue(value, 0)
  }

  // Single line without special characters
  if (!value.includes("\n")) {
    return JSON.stringify(value)
  }

  // Check for shell-specific patterns that require keeping as single string
  const shellOperatorPatterns = [
    /\\\n/, // Line continuation
    /<</, // Heredoc
    /(?<!\|)\|(?!\|)/, // Pipe (but not ||) - negative lookbehind and lookahead
    />>?/, // Redirect output
    /2>/, // Redirect stderr
    /&>/, // Redirect both
    /(?<!<)<(?!<)/, // Redirect input (but not <<) - negative lookbehind and lookahead
  ]

  const hasShellOperators = shellOperatorPatterns.some((pattern) => pattern.test(value))

  if (hasShellOperators) {
    // Keep as template literal to preserve exact formatting
    // Escape backticks and ${} in the string
    const escaped = value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")
    return `\`${escaped}\``
  }

  // Simple multi-line without shell operators - split into array
  const lines = value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 1) {
    return JSON.stringify(lines[0])
  }

  return `[${lines.map((l) => JSON.stringify(l)).join(", ")}]`
}

/**
 * Format a value as TypeScript code with proper indentation.
 * @param value - The value to format
 * @param indentLevel - The indentation level
 * @param addExtraIndent - Whether to add an extra level of indentation (for function bodies)
 */
function formatValue(value: unknown, indentLevel: number, addExtraIndent = false): string {
  const baseIndent = addExtraIndent ? "  " : ""
  const indent = baseIndent + "  ".repeat(indentLevel)

  if (value === null || value === undefined) {
    return "undefined"
  }

  if (typeof value === "string") {
    return JSON.stringify(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    // Check if all elements are simple (string, number, boolean)
    const allSimple = value.every(
      (v) =>
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null ||
        v === undefined,
    )

    if (allSimple) {
      return `[${value.map((v) => formatValue(v, 0, addExtraIndent)).join(", ")}]`
    }

    // Complex array - multi-line
    const items = value.map((v) => `${indent}${formatValue(v, indentLevel + 1, addExtraIndent)}`)
    return `[\n${items.join(",\n")},\n${indent.slice(baseIndent.length + 2)}]`
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return "{}"
    }

    // Format as multi-line object
    const props = entries.map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)

      // Special handling for script-related properties
      const scriptProperties = ["script", "before_script", "after_script"]
      if (scriptProperties.includes(k)) {
        // For script arrays, format each element intelligently and FLATTEN
        if (Array.isArray(v)) {
          const flattened: string[] = []
          for (const item of v) {
            if (typeof item === "string") {
              // Detect simple multi-line string without shell operators and split into lines
              const hasNewline = item.includes("\n")
              if (hasNewline) {
                const shellOperatorPatterns = [
                  /\\\n/, // Line continuation
                  /<</, // Heredoc
                  /(?<!\|)\|(?!\|)/, // Pipe (but not ||)
                  />>?/, // Redirect output
                  /2>/, // Redirect stderr
                  /&>/, // Redirect both
                  /(?<!<)<(?!<)/, // Redirect input (but not <<)
                ]
                const hasShellOperators = shellOperatorPatterns.some((p) => p.test(item))
                if (!hasShellOperators) {
                  const linesSplit = item
                    .split("\n")
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0)
                  if (linesSplit.length > 0) {
                    for (const line of linesSplit) {
                      flattened.push(JSON.stringify(line))
                    }
                    continue
                  }
                }
              }
            }
            const formatted = formatScriptValue(item)
            // If formatted result itself looks like an array literal ["..."] we should expand it
            if (/^\[(?:.|\n)*\]$/.test(formatted)) {
              // Attempt to parse safely by wrapping in JSON (replace single backticks/template etc.)
              try {
                // Replace trailing commas if any and parse as JSON after ensuring double quotes
                const jsonCandidate = formatted
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const parsed = JSON.parse(jsonCandidate)
                if (Array.isArray(parsed)) {
                  for (const inner of parsed) {
                    flattened.push(JSON.stringify(inner))
                  }
                  continue
                }
              } catch {
                // Fallback: just push formatted string literal as is
              }
            }
            flattened.push(formatted)
          }
          return `${indent}${key}: [${flattened.join(", ")}]`
        }
        return `${indent}${key}: ${formatScriptValue(v)}`
      }

      // Special handling for properties that should be strings but might be single-element arrays
      // These properties accept string | string[] but single values are more common
      const singleValueProperties = ["extends", "annotations", "dotenv"]
      if (singleValueProperties.includes(k) && Array.isArray(v) && v.length === 1) {
        return `${indent}${key}: ${formatValue(v[0], indentLevel + 1, addExtraIndent)}`
      }

      return `${indent}${key}: ${formatValue(v, indentLevel + 1, addExtraIndent)}`
    })

    return `{\n${props.join(",\n")},\n${indent.slice(baseIndent.length + 2)}}`
  }

  return JSON.stringify(value)
}

/**
 * Read a GitLab CI YAML file and convert it to TypeScript Config builder code.
 *
 * @param yamlPath - Path to the `.gitlab-ci.yml` file to import.
 * @param outputPath - Optional path where to write the generated TypeScript file.
 * @param options - Optional configuration for the conversion.
 * @returns The generated TypeScript code.
 */
export async function importYamlFile(
  yamlPath: string,
  outputPath?: string,
  options?: ImportOptions,
): Promise<string> {
  const content = await fs.readFile(yamlPath, "utf-8")
  const tsCode = fromYaml(content, options)

  if (outputPath) {
    await fs.writeFile(outputPath, tsCode, "utf-8")
  }

  return tsCode
}

export default { fromYaml, importYamlFile }
