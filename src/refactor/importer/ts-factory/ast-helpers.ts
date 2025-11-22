import ts from "typescript"

/**
 * Create an import declaration
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
 * Create a method call expression: config.method(...args)
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
 * Convert a JavaScript value to a TypeScript expression
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
  // Only escape ${, backticks are automatically escaped by the printer
  const escaped = text.replace(/\$\{/g, "\\${")

  return ts.factory.createNoSubstitutionTemplateLiteral(escaped)
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
