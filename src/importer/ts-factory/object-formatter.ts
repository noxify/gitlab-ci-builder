import ts from "typescript"

import { valueToExpression } from "./ast-helpers"
import { formatScriptProperty, SCRIPT_PROPERTIES } from "./script-formatter"

/**
 * Properties that should remain as single values if array has only one element
 */
const SINGLE_VALUE_PROPERTIES = ["extends", "image", "needs", "annotations", "dotenv"] as const

/**
 * Check if a value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Convert a value to expression with context-aware formatting
 */
function valueWithContext(key: string, value: unknown): ts.Expression {
  // Script properties need special formatting
  if (SCRIPT_PROPERTIES.includes(key as (typeof SCRIPT_PROPERTIES)[number])) {
    return formatScriptProperty(value)
  }

  // Single value properties: unwrap single-element arrays
  if (
    SINGLE_VALUE_PROPERTIES.includes(key as (typeof SINGLE_VALUE_PROPERTIES)[number]) &&
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
 * Convert a JavaScript object to an object literal expression with smart formatting
 */
export function objectToExpression(
  obj: Record<string, unknown>,
  forceQuotedKeys = false,
): ts.ObjectLiteralExpression {
  const properties = Object.entries(obj).map(([key, value]) => {
    // Force quoted keys for variables or if key is not a valid identifier
    const propertyName =
      forceQuotedKeys || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? ts.factory.createStringLiteral(key)
        : ts.factory.createIdentifier(key)

    const propertyValue = valueWithContext(key, value)

    return ts.factory.createPropertyAssignment(propertyName, propertyValue)
  })

  return ts.factory.createObjectLiteralExpression(properties, properties.length > 1)
}
