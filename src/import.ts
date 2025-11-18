import fs from "fs/promises"
import yaml from "js-yaml"

/**
 * Convert a GitLab CI YAML string to TypeScript Config builder code.
 *
 * @param yamlContent - The YAML string to parse and convert.
 * @returns TypeScript code as a string that uses the Config builder API.
 */
export function fromYaml(yamlContent: string): string {
  const parsed = yaml.load(yamlContent) as Record<string, unknown>

  const lines: string[] = []
  lines.push('import { Config } from "gitlab-ci-builder"')
  lines.push("")
  lines.push("const config = new Config()")
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

  // Stages
  if (topLevel.stages && Array.isArray(topLevel.stages) && topLevel.stages.length > 0) {
    lines.push(`config.stages(${topLevel.stages.map((s) => JSON.stringify(s)).join(", ")})`)
    lines.push("")
  }

  // Workflow
  if (topLevel.workflow) {
    lines.push(`config.workflow(${formatValue(topLevel.workflow, 1)})`)
    lines.push("")
  }

  // Include
  if (topLevel.include && Array.isArray(topLevel.include) && topLevel.include.length > 0) {
    for (const inc of topLevel.include) {
      lines.push(`config.include(${formatValue(inc, 1)})`)
    }
    lines.push("")
  }

  // Variables
  if (topLevel.variables && typeof topLevel.variables === "object") {
    lines.push("config.variables({")
    for (const [key, value] of Object.entries(topLevel.variables as Record<string, unknown>)) {
      lines.push(`  ${JSON.stringify(key)}: ${formatValue(value, 1)},`)
    }
    lines.push("})")
    lines.push("")
  }

  // Default
  if (topLevel.default) {
    lines.push(`config.defaults(${formatValue(topLevel.default, 1)})`)
    lines.push("")
  }

  // Jobs (separate templates and regular jobs)
  const templateKeys = Object.keys(jobs).filter((k) => k.startsWith("."))
  const jobKeys = Object.keys(jobs).filter((k) => !k.startsWith("."))

  // Templates first
  for (const key of templateKeys) {
    const job = jobs[key]
    if (job) {
      lines.push(`config.template(${JSON.stringify(key)}, ${formatValue(job, 1)})`)
      lines.push("")
    }
  }

  // Regular jobs
  for (const key of jobKeys) {
    const job = jobs[key]
    if (job) {
      lines.push(`config.job(${JSON.stringify(key)}, ${formatValue(job, 1)})`)
      lines.push("")
    }
  }

  lines.push("export default config")

  return lines.join("\n")
}

/**
 * Format a value as TypeScript code with proper indentation.
 */
function formatValue(value: unknown, indentLevel: number): string {
  const indent = "  ".repeat(indentLevel)

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
      return `[${value.map((v) => formatValue(v, 0)).join(", ")}]`
    }

    // Complex array - multi-line
    const items = value.map((v) => `${indent}${formatValue(v, indentLevel + 1)}`)
    return `[\n${items.join(",\n")},\n${indent.slice(2)}]`
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return "{}"
    }

    // Format as multi-line object
    const props = entries.map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)
      return `${indent}${key}: ${formatValue(v, indentLevel + 1)}`
    })

    return `{\n${props.join(",\n")},\n${indent.slice(2)}}`
  }

  return JSON.stringify(value)
}

/**
 * Read a GitLab CI YAML file and convert it to TypeScript Config builder code.
 *
 * @param yamlPath - Path to the `.gitlab-ci.yml` file to import.
 * @param outputPath - Optional path where to write the generated TypeScript file.
 * @returns The generated TypeScript code.
 */
export async function importYamlFile(yamlPath: string, outputPath?: string): Promise<string> {
  const content = await fs.readFile(yamlPath, "utf-8")
  const tsCode = fromYaml(content)

  if (outputPath) {
    await fs.writeFile(outputPath, tsCode, "utf-8")
  }

  return tsCode
}

export default { fromYaml, importYamlFile }
