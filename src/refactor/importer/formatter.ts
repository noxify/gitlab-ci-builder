import {
  hasControlStructures,
  hasShellOperators,
  SCRIPT_PROPERTIES,
  SINGLE_VALUE_PROPERTIES,
} from "./ts-factory/utils"

/**
 * Format options for value formatting
 */
interface FormatOptions {
  indentLevel: number
  addExtraIndent?: boolean
}

/**
 * Format a script value intelligently
 * Detects shell patterns and formats accordingly
 */
export function formatScriptValue(value: unknown): string {
  if (typeof value !== "string") {
    return formatValue(value, { indentLevel: 0 })
  }

  // Single line without special characters
  if (!value.includes("\n")) {
    return JSON.stringify(value)
  }

  // Check for shell-specific patterns
  if (hasShellOperators(value) || hasControlStructures(value)) {
    // Keep as template literal to preserve exact formatting
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
 * Format an array value
 */
function formatArray(value: unknown[], options: FormatOptions): string {
  if (value.length === 0) {
    return "[]"
  }

  const baseIndent = options.addExtraIndent ? "  " : ""
  const indent = baseIndent + "  ".repeat(options.indentLevel)

  // Check if all elements are simple
  const allSimple = value.every(
    (v) =>
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      v === null ||
      v === undefined,
  )

  if (allSimple) {
    return `[${value.map((v) => formatValue(v, { indentLevel: 0, addExtraIndent: options.addExtraIndent })).join(", ")}]`
  }

  // Complex array - multi-line
  const items = value.map(
    (v) =>
      `${indent}${formatValue(v, { indentLevel: options.indentLevel + 1, addExtraIndent: options.addExtraIndent })}`,
  )
  return `[\n${items.join(",\n")},\n${indent.slice(baseIndent.length + 2)}]`
}

/**
 * Flatten script arrays intelligently
 */
function flattenScriptArray(items: unknown[]): string[] {
  const flattened: string[] = []

  for (const item of items) {
    if (typeof item === "string") {
      const hasNewline = item.includes("\n")
      if (hasNewline && !hasShellOperators(item) && !hasControlStructures(item)) {
        const lines = item
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)

        for (const line of lines) {
          flattened.push(JSON.stringify(line))
        }
        continue
      }
    }

    const formatted = formatScriptValue(item)

    // If formatted result is an array, expand it
    if (/^\[(?:.|\n)*\]$/.test(formatted)) {
      try {
        const parsed = JSON.parse(formatted) as unknown
        if (Array.isArray(parsed)) {
          for (const inner of parsed) {
            flattened.push(JSON.stringify(inner))
          }
          continue
        }
      } catch {
        // Fallback: just push formatted string
      }
    }

    flattened.push(formatted)
  }

  return flattened
}

/**
 * Format an object value
 */
function formatObject(value: Record<string, unknown>, options: FormatOptions): string {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return "{}"
  }

  const baseIndent = options.addExtraIndent ? "  " : ""
  const indent = baseIndent + "  ".repeat(options.indentLevel)

  const props = entries.map(([key, val]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)

    // Script properties
    if (SCRIPT_PROPERTIES.includes(key as (typeof SCRIPT_PROPERTIES)[number])) {
      if (Array.isArray(val)) {
        const flattened = flattenScriptArray(val)
        return `${indent}${formattedKey}: [${flattened.join(", ")}]`
      }
      return `${indent}${formattedKey}: ${formatScriptValue(val)}`
    }

    // Single value properties (string | string[])
    if (
      SINGLE_VALUE_PROPERTIES.includes(key as (typeof SINGLE_VALUE_PROPERTIES)[number]) &&
      Array.isArray(val) &&
      val.length === 1
    ) {
      return `${indent}${formattedKey}: ${formatValue(val[0], { indentLevel: options.indentLevel + 1, addExtraIndent: options.addExtraIndent })}`
    }

    return `${indent}${formattedKey}: ${formatValue(val, { indentLevel: options.indentLevel + 1, addExtraIndent: options.addExtraIndent })}`
  })

  return `{\n${props.join(",\n")},\n${indent.slice(baseIndent.length + 2)}}`
}

/**
 * Format a value as TypeScript code
 */
export function formatValue(value: unknown, options: FormatOptions): string {
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
    return formatArray(value, options)
  }

  if (typeof value === "object") {
    return formatObject(value as Record<string, unknown>, options)
  }

  return JSON.stringify(value)
}
