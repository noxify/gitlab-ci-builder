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
 * Format a script value intelligently.
 *
 * Detects shell patterns and formats accordingly:
 * - Single-line strings are quoted
 * - Multi-line strings with shell operators are kept as template literals
 * - Simple multi-line strings are split into arrays
 *
 * @param value - The value to format (typically a script string)
 * @returns Formatted TypeScript code string
 *
 * @example
 * ```ts
 * formatScriptValue('npm run build') // Returns: '"npm run build"'
 *
 * formatScriptValue('npm ci\nnpm test') // Returns: '["npm ci", "npm test"]'
 *
 * formatScriptValue('if [ -f package.json ]; then\n  npm ci\nfi')
 * // Returns: template literal preserving shell syntax
 * ```
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
    const escaped = value.replaceAll("`", "\\`").replaceAll("${", "\\${")
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
 * Format an array value as TypeScript array literal.
 *
 * Handles both simple arrays (single line) and complex arrays (multi-line with proper indentation).
 * Simple arrays contain only primitives, while complex arrays may contain nested objects or arrays.
 *
 * @param value - The array to format
 * @param options - Formatting options (indentation level and extra indent flag)
 * @returns Formatted TypeScript array literal string
 *
 * @example
 * ```ts
 * formatArray(['a', 'b'], { indentLevel: 0 }) // Returns: '["a", "b"]'
 * formatArray([{ key: 'value' }], { indentLevel: 0 }) // Returns multi-line formatted array
 * ```
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
      v === undefined
  )

  if (allSimple) {
    return `[${value.map((v) => formatValue(v, { indentLevel: 0, addExtraIndent: options.addExtraIndent })).join(", ")}]`
  }

  // Complex array - multi-line
  const items = value.map(
    (v) =>
      `${indent}${formatValue(v, { indentLevel: options.indentLevel + 1, addExtraIndent: options.addExtraIndent })}`
  )
  return `[\n${items.join(",\n")},\n${indent.slice(baseIndent.length + 2)}]`
}

/**
 * Flatten script arrays intelligently.
 *
 * Processes script arrays by expanding multi-line strings into individual commands
 * when they don't contain shell operators. This creates cleaner, more maintainable
 * script arrays in the generated code.
 *
 * @param items - Array of script items (strings or other values)
 * @returns Array of formatted script command strings
 *
 * @example
 * ```ts
 * flattenScriptArray(['npm ci', 'npm test\nnpm run lint'])
 * // Returns: ['"npm ci"', '"npm test"', '"npm run lint"']
 *
 * flattenScriptArray(['if test; then\n  echo ok\nfi'])
 * // Returns: ['`if test; then\n  echo ok\nfi`'] (preserved as single item)
 * ```
 */
function flattenScriptArray(items: unknown[]): string[] {
  const flattened: string[] = []

  for (const item of items) {
    if (typeof item === "string") {
      const hasNewline = item.includes("\n")
      if (
        hasNewline &&
        !hasShellOperators(item) &&
        !hasControlStructures(item)
      ) {
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
    if (/^\[(?:.|\n)*\]$/u.test(formatted)) {
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
 * Format an object value as TypeScript object literal.
 *
 * Applies context-aware formatting based on property keys:
 * - Script properties (script, before_script, after_script) use special script formatting
 * - Single-value properties unwrap single-element arrays
 * - Other properties are formatted according to their type
 *
 * @param value - The object to format
 * @param options - Formatting options (indentation level and extra indent flag)
 * @returns Formatted TypeScript object literal string
 *
 * @example
 * ```ts
 * formatObject({ stage: 'build', script: ['npm ci', 'npm test'] }, { indentLevel: 0 })
 * // Returns: multi-line formatted object with proper script handling
 * ```
 */
function formatObject(
  value: Record<string, unknown>,
  options: FormatOptions
): string {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return "{}"
  }

  const baseIndent = options.addExtraIndent ? "  " : ""
  const indent = baseIndent + "  ".repeat(options.indentLevel)

  const props = entries.map(([key, val]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(key)
      ? key
      : JSON.stringify(key)

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
      SINGLE_VALUE_PROPERTIES.includes(
        key as (typeof SINGLE_VALUE_PROPERTIES)[number]
      ) &&
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
 * Format a value as TypeScript code.
 *
 * Handles various value types and converts them to proper TypeScript syntax:
 * - Primitives: strings, numbers, booleans
 * - Arrays: with proper formatting and indentation
 * - Objects: with proper property formatting
 *
 * @param value - The value to format
 * @param options - Formatting options
 * @param options.indentLevel - Current indentation level
 * @param options.addExtraIndent - Add extra indentation for nested structures
 * @returns Formatted TypeScript code string
 *
 * @example
 * ```ts
 * formatValue('hello', { indentLevel: 0 }) // Returns: '"hello"'
 * formatValue(42, { indentLevel: 0 }) // Returns: '42'
 * formatValue(['a', 'b'], { indentLevel: 0 }) // Returns: '["a", "b"]'
 * ```
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
