import ts from "typescript"

/**
 * Create an import declaration AST node.
 *
 * Generates TypeScript import statements for the ConfigBuilder module.
 *
 * @param moduleSpecifier - The module path to import from
 * @param isTypeOnly - Whether this is a type-only import
 * @param namedImports - Array of named imports (optional)
 * @returns TypeScript ImportDeclaration AST node
 *
 * @example
 * ```ts
 * // import { ConfigBuilder } from '@noxify/gitlab-ci-builder'
 * createImportDeclaration('@noxify/gitlab-ci-builder', false, ['ConfigBuilder'])
 *
 * // import type { ConfigBuilder } from '@noxify/gitlab-ci-builder'
 * createImportDeclaration('@noxify/gitlab-ci-builder', true, ['ConfigBuilder'])
 * ```
 */
export function createImportDeclaration(
  moduleSpecifier: string,
  isTypeOnly: boolean,
  namedImports?: string[],
): ts.ImportDeclaration {
  if (namedImports && namedImports.length > 0) {
    return ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        isTypeOnly,
        undefined,
        ts.factory.createNamedImports(
          namedImports.map((name) =>
            ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name)),
          ),
        ),
      ),
      ts.factory.createStringLiteral(moduleSpecifier),
    )
  }

  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      isTypeOnly,
      ts.factory.createIdentifier("ConfigBuilder"),
      undefined,
    ),
    ts.factory.createStringLiteral(moduleSpecifier),
  )
}

/**
 * Create a method call expression AST node.
 *
 * Generates method call expressions like `config.stages('build', 'test')`.
 *
 * @param objectName - The object name (e.g., 'config')
 * @param methodName - The method name (e.g., 'stages')
 * @param args - Array of argument expressions
 * @returns TypeScript CallExpression AST node
 *
 * @example
 * ```ts
 * // config.stages('build', 'test')
 * createMethodCall('config', 'stages', [
 *   ts.factory.createStringLiteral('build'),
 *   ts.factory.createStringLiteral('test')
 * ])
 * ```
 */
export function createMethodCall(
  objectName: string,
  methodName: string,
  args: ts.Expression[],
): ts.CallExpression {
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier(objectName),
      ts.factory.createIdentifier(methodName),
    ),
    undefined,
    args,
  )
}

/**
 * Convert a JavaScript value to a TypeScript expression AST node.
 *
 * Handles primitives, arrays, objects, and special values (null/undefined).
 *
 * @param value - The JavaScript value to convert
 * @returns TypeScript Expression AST node
 *
 * @example
 * ```ts
 * valueToExpression('hello') // StringLiteral: "hello"
 * valueToExpression(42) // NumericLiteral: 42
 * valueToExpression(true) // BooleanLiteral: true
 * valueToExpression(['a', 'b']) // ArrayLiteralExpression: ["a", "b"]
 * ```
 */
export function valueToExpression(value: unknown): ts.Expression {
  // null and undefined
  if (value === null || value === undefined) {
    return ts.factory.createIdentifier("undefined")
  }

  // Primitives
  if (typeof value === "string") {
    return ts.factory.createStringLiteral(value)
  }

  if (typeof value === "number") {
    return ts.factory.createNumericLiteral(value)
  }

  if (typeof value === "boolean") {
    return value ? ts.factory.createTrue() : ts.factory.createFalse()
  }

  // Arrays
  if (Array.isArray(value)) {
    return ts.factory.createArrayLiteralExpression(
      value.map((item) => valueToExpression(item)),
      false, // Always single-line for simple arrays
    )
  }

  // Objects
  if (typeof value === "object") {
    const properties = Object.entries(value).map(([key, val]) => {
      const propertyName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? ts.factory.createIdentifier(key)
        : ts.factory.createStringLiteral(key)

      return ts.factory.createPropertyAssignment(propertyName, valueToExpression(val))
    })

    return ts.factory.createObjectLiteralExpression(properties, properties.length > 1)
  }

  // Fallback
  return ts.factory.createIdentifier("undefined")
}

/**
 * Create a template literal for multi-line strings
 */
export function createTemplateLiteral(text: string): ts.TemplateLiteral {
  // No need to escape ${ - TypeScript printer handles it automatically
  return ts.factory.createNoSubstitutionTemplateLiteral(text)
}

/**
 * Create an array of string literals
 */
export function createStringArray(values: string[]): ts.ArrayLiteralExpression {
  return ts.factory.createArrayLiteralExpression(
    values.map((v) => ts.factory.createStringLiteral(v)),
    false,
  )
}

/**
 * Create variable declaration: const name = initializer
 */
export function createConstDeclaration(
  name: string,
  initializer: ts.Expression,
): ts.VariableStatement {
  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier(name),
          undefined,
          undefined,
          initializer,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  )
}

/**
 * Create function declaration: function name(params) { body }
 */
export function createFunctionDeclaration(
  name: string,
  parameters: ts.ParameterDeclaration[],
  body: ts.Statement[],
  isExportDefault = false,
): ts.FunctionDeclaration {
  const modifiers = isExportDefault
    ? [
        ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
        ts.factory.createToken(ts.SyntaxKind.DefaultKeyword),
      ]
    : undefined

  return ts.factory.createFunctionDeclaration(
    modifiers,
    undefined,
    ts.factory.createIdentifier(name),
    undefined,
    parameters,
    undefined,
    ts.factory.createBlock(body, true),
  )
}

/**
 * Create parameter declaration with type annotation
 */
export function createParameter(name: string, typeName: string): ts.ParameterDeclaration {
  return ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    ts.factory.createIdentifier(name),
    undefined,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(typeName)),
  )
}

/**
 * Create return statement
 */
export function createReturnStatement(expression: ts.Expression): ts.ReturnStatement {
  return ts.factory.createReturnStatement(expression)
}

/**
 * Create export default statement
 */
export function createExportDefault(expression: ts.Expression): ts.ExportAssignment {
  return ts.factory.createExportAssignment(undefined, undefined, expression)
}
