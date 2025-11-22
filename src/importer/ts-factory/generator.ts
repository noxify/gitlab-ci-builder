import ts from "typescript"

import {
  createConstDeclaration,
  createExportDefault,
  createFunctionDeclaration,
  createImportDeclaration,
  createMethodCall,
  createParameter,
  createReturnStatement,
  valueToExpression,
} from "./ast-helpers"
import { objectToExpression } from "./object-formatter"
import { categorizeJobs, separateTopLevelAndJobs } from "./utils"

/**
 * Options for code generation
 */
export interface CodeGeneratorOptions {
  /**
   * Generate extended config with type-only import and function-based export
   * @default false
   */
  asExtendedConfig?: boolean
}

/**
 * Code generator for converting parsed YAML to TypeScript using AST
 */
export class CodeGenerator {
  private options: Required<CodeGeneratorOptions>

  constructor(options: CodeGeneratorOptions = {}) {
    this.options = {
      asExtendedConfig: options.asExtendedConfig ?? false,
    }
  }

  /**
   * Generate TypeScript code from parsed YAML
   */
  public generate(parsed: Record<string, unknown>): string {
    const statements: ts.Statement[] = []

    // Add import
    statements.push(this.createImport())

    // Separate top-level config from jobs
    const { topLevel, jobs } = separateTopLevelAndJobs(parsed)
    const { templates, regularJobs } = categorizeJobs(jobs)

    // Create body statements
    const bodyStatements = this.createBodyStatements(topLevel, templates, regularJobs)

    if (this.options.asExtendedConfig) {
      // Create function: export default function (config: ConfigBuilder) { ... }
      const func = createFunctionDeclaration(
        "",
        [createParameter("config", "ConfigBuilder")],
        [...bodyStatements, createReturnStatement(ts.factory.createIdentifier("config"))],
        true,
      )
      statements.push(func)
    } else {
      // Create const declaration: const config = new ConfigBuilder()
      statements.push(
        createConstDeclaration(
          "config",
          ts.factory.createNewExpression(
            ts.factory.createIdentifier("ConfigBuilder"),
            undefined,
            [],
          ),
        ),
      )

      // Add body statements
      statements.push(...bodyStatements)

      // Add export: export default config
      statements.push(createExportDefault(ts.factory.createIdentifier("config")))
    }

    // Create source file and print
    const sourceFile = ts.factory.createSourceFile(
      statements,
      ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None,
    )

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      omitTrailingSemicolon: true,
    })

    return printer.printFile(sourceFile)
  }

  /**
   * Create import statement
   */
  private createImport(): ts.ImportDeclaration {
    return createImportDeclaration("@noxify/gitlab-ci-builder", this.options.asExtendedConfig, [
      "ConfigBuilder",
    ])
  }

  /**
   * Create body statements for config builder calls
   */
  private createBodyStatements(
    topLevel: {
      stages?: unknown
      workflow?: unknown
      include?: unknown
      variables?: unknown
      default?: unknown
      spec?: unknown
    },
    templates: [string, Record<string, unknown>][],
    jobs: [string, Record<string, unknown>][],
  ): ts.Statement[] {
    const statements: ts.Statement[] = []

    // Stages
    if (Array.isArray(topLevel.stages) && topLevel.stages.length > 0) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall(
            "config",
            "stages",
            topLevel.stages.map((s) => valueToExpression(s)),
          ),
        ),
      )
    }

    // Workflow
    if (topLevel.workflow) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall("config", "workflow", [
            objectToExpression(topLevel.workflow as Record<string, unknown>),
          ]),
        ),
      )
    }

    // Include
    if (Array.isArray(topLevel.include) && topLevel.include.length > 0) {
      for (const inc of topLevel.include) {
        statements.push(
          ts.factory.createExpressionStatement(
            createMethodCall("config", "include", [
              objectToExpression(inc as Record<string, unknown>),
            ]),
          ),
        )
      }
    }

    // Variables
    if (
      topLevel.variables &&
      typeof topLevel.variables === "object" &&
      !Array.isArray(topLevel.variables)
    ) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall("config", "variables", [
            objectToExpression(topLevel.variables as Record<string, unknown>, true),
          ]),
        ),
      )
    }

    // Defaults
    if (topLevel.default) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall("config", "defaults", [
            objectToExpression(topLevel.default as Record<string, unknown>),
          ]),
        ),
      )
    }

    // Spec
    if (topLevel.spec) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall("config", "spec", [
            objectToExpression(topLevel.spec as Record<string, unknown>),
          ]),
        ),
      )
    }

    // Templates
    for (const [name, definition] of templates) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall("config", "template", [
            ts.factory.createStringLiteral(name),
            objectToExpression(definition),
          ]),
        ),
      )
    }

    // Jobs
    for (const [name, definition] of jobs) {
      statements.push(
        ts.factory.createExpressionStatement(
          createMethodCall("config", "job", [
            ts.factory.createStringLiteral(name),
            objectToExpression(definition),
          ]),
        ),
      )
    }

    return statements
  }
}
