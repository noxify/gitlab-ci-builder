import ts from "typescript"

import { createStringArray, createTemplateLiteral, valueToExpression } from "./ast-helpers"
import { hasControlStructures, hasShellOperators } from "./utils"

/**
 * Script properties that need special formatting
 */
export const SCRIPT_PROPERTIES = ["script", "before_script", "after_script"] as const

/**
 * Format a script value as AST expression.
 *
 * Detects shell patterns and formats accordingly:
 * - Single-line strings become string literals
 * - Multi-line strings with shell operators become template literals
 * - Simple multi-line strings are split into string arrays
 *
 * @param value - The script value to format
 * @returns TypeScript Expression AST node
 *
 * @example
 * ```ts
 * formatScriptValue('npm run build') // StringLiteral
 * formatScriptValue('npm ci\nnpm test') // ArrayLiteralExpression
 * formatScriptValue('if [ -f file ]; then\n  echo "exists"\nfi') // TemplateLiteral
 * ```
 */
export function formatScriptValue(value: unknown): ts.Expression {
  if (typeof value !== "string") {
    return valueToExpression(value)
  }

  // Single line without special characters
  if (!value.includes("\n")) {
    return ts.factory.createStringLiteral(value)
  }

  // Check for shell-specific patterns
  if (hasShellOperators(value) || hasControlStructures(value)) {
    // Keep as template literal to preserve exact formatting
    return createTemplateLiteral(value)
  }

  // Simple multi-line without shell operators - split into array
  const lines = value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 1 && lines[0]) {
    return ts.factory.createStringLiteral(lines[0])
  }

  return createStringArray(lines)
}

/**
 * Flatten script arrays intelligently.
 *
 * Processes arrays of script commands, expanding multi-line strings into
 * individual commands when appropriate.
 *
 * @param items - Array of script items to flatten
 * @returns TypeScript ArrayLiteralExpression AST node
 *
 * @example
 * ```ts
 * flattenScriptArray(['npm ci', 'npm test\nnpm run lint'])
 * // Result: ['npm ci', 'npm test', 'npm run lint']
 * ```
 */
export function flattenScriptArray(items: unknown[]): ts.Expression {
  const flattened: ts.Expression[] = []

  for (const item of items) {
    if (typeof item === "string") {
      const hasNewline = item.includes("\n")
      if (hasNewline && !hasShellOperators(item) && !hasControlStructures(item)) {
        const lines = item
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)

        for (const line of lines) {
          flattened.push(ts.factory.createStringLiteral(line))
        }
        continue
      }
    }

    const formatted = formatScriptValue(item)

    // If formatted result is an array, expand it
    if (ts.isArrayLiteralExpression(formatted)) {
      flattened.push(...formatted.elements)
    } else {
      flattened.push(formatted)
    }
  }

  return ts.factory.createArrayLiteralExpression(flattened, false)
}

/**
 * Format a script property value.
 *
 * Handles both single values and arrays, applying appropriate formatting.
 *
 * @param value - The script property value to format
 * @returns TypeScript Expression AST node
 *
 * @example
 * ```ts
 * formatScriptProperty('npm run build') // StringLiteral
 * formatScriptProperty(['npm ci', 'npm test']) // ArrayLiteralExpression
 * ```
 */
export function formatScriptProperty(value: unknown): ts.Expression {
  if (Array.isArray(value)) {
    return flattenScriptArray(value)
  }
  return formatScriptValue(value)
}
