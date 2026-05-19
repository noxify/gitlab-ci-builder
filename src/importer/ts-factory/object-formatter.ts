import ts from "typescript"

import { valueToExpression } from "./ast-helpers"
import { formatScriptProperty } from "./script-formatter"
import { SCRIPT_PROPERTIES, SINGLE_VALUE_PROPERTIES } from "./utils"

/**
 * Check if a value is a plain object.
 *
 * Determines if a value is a non-null object that is not an array.
 * Useful for distinguishing objects from other types during AST generation.
 *
 * @param value - The value to check
 * @returns True if value is a plain object (not null, not array)
 *
 * @example
 * ```ts
 * isPlainObject({ key: 'value' }) // Returns: true
 * isPlainObject([1, 2, 3]) // Returns: false
 * isPlainObject(null) // Returns: false
 * ```
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Convert a value to TypeScript expression with context-aware formatting.
 *
 * Applies special formatting rules based on the property key:
 * - Script properties (script, before_script, after_script) use script formatter
 * - Single-value properties unwrap single-element arrays for cleaner code
 * - Nested objects are recursively formatted with context awareness
 * - Other values use default expression conversion
 *
 * @param key - The property key for context-aware formatting
 * @param value - The value to convert to a TypeScript expression
 * @returns TypeScript Expression AST node
 *
 * @example
 * ```ts
 * valueWithContext('script', ['npm test'])
 * // Returns: ArrayLiteralExpression with script formatting
 *
 * valueWithContext('extends', ['.template'])
 * // Returns: StringLiteral ".template" (unwrapped from array)
 * ```
 */
function valueWithContext(key: string, value: unknown): ts.Expression {
  // Script properties need special formatting
  if (SCRIPT_PROPERTIES.includes(key as (typeof SCRIPT_PROPERTIES)[number])) {
    return formatScriptProperty(value)
  }

  // Single value properties: unwrap single-element arrays
  if (
    SINGLE_VALUE_PROPERTIES.includes(
      key as (typeof SINGLE_VALUE_PROPERTIES)[number]
    ) &&
    Array.isArray(value) &&
    value.length === 1
  ) {
    return valueToExpression(value[0])
  }

  // Nested objects: recursively apply context-aware formatting
  if (isPlainObject(value)) {
    return objectToExpression(value)
  }

  // Default: use valueToExpression
  return valueToExpression(value)
}

/**
 * Convert a JavaScript object to an object literal expression with smart formatting.
 *
 * Applies context-aware formatting based on property keys:
 * - Script properties use special script formatting
 * - Single-value properties unwrap single-element arrays
 * - Nested objects are recursively formatted
 *
 * @param obj - The JavaScript object to convert
 * @param forceQuotedKeys - Force all keys to be quoted (e.g., for variables)
 * @returns TypeScript ObjectLiteralExpression AST node
 *
 * @example
 * ```ts
 * objectToExpression({
 *   stage: 'build',
 *   script: ['npm ci', 'npm run build']
 * })
 * // Result: { stage: "build", script: ["npm ci", "npm run build"] }
 * ```
 */
export function objectToExpression(
  obj: Record<string, unknown>,
  forceQuotedKeys = false
): ts.ObjectLiteralExpression {
  const properties = Object.entries(obj).map(([key, value]) => {
    // Force quoted keys for variables or if key is not a valid identifier
    const propertyName =
      forceQuotedKeys || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(key)
        ? ts.factory.createStringLiteral(key)
        : ts.factory.createIdentifier(key)

    const propertyValue = valueWithContext(key, value)

    return ts.factory.createPropertyAssignment(propertyName, propertyValue)
  })

  return ts.factory.createObjectLiteralExpression(
    properties,
    properties.length > 1
  )
}
