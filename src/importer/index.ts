import fs from "fs/promises"

import type { CodeGeneratorOptions } from "./ts-factory/generator"
import { parseYaml } from "./parser"
import { CodeGenerator } from "./ts-factory/generator"

/**
 * Options for YAML to TypeScript conversion
 */
export type ImportOptions = CodeGeneratorOptions

/**
 * Convert a GitLab CI YAML string to TypeScript ConfigBuilder code.
 *
 * This function parses GitLab CI YAML configuration and generates equivalent
 * TypeScript code using the ConfigBuilder API. The generated code can be used
 * as a starting point for migrating from YAML to TypeScript-based configuration.
 *
 * @param yamlContent - The GitLab CI YAML string to parse and convert
 * @param options - Optional configuration for the code generation
 * @param options.asExtendedConfig - Generate as an extended config function (default: false)
 * @returns TypeScript code as a string
 *
 * @example
 * ```ts
 * import { fromYaml } from '@noxify/gitlab-ci-builder'
 *
 * const yaml = `
 * stages:
 *   - build
 *   - test
 *
 * build:
 *   stage: build
 *   script: npm run build
 * `
 *
 * const tsCode = fromYaml(yaml)
 * console.log(tsCode)
 * // Output:
 * // import { ConfigBuilder } from '@noxify/gitlab-ci-builder'
 * // const config = new ConfigBuilder()
 * //   .stages('build', 'test')
 * //   .job('build', { stage: 'build', script: 'npm run build' })
 * // export default config
 * ```
 *
 * @example
 * ```ts
 * // Generate as extended config function
 * const tsCode = fromYaml(yaml, { asExtendedConfig: true })
 * // Output:
 * // import type { ConfigBuilder } from '@noxify/gitlab-ci-builder'
 * // export default function (config: ConfigBuilder) {
 * //   return config.stages('build', 'test')
 * //     .job('build', { stage: 'build', script: 'npm run build' })
 * // }
 * ```
 */
export function fromYaml(yamlContent: string, options?: ImportOptions): string {
  const parsed = parseYaml(yamlContent)
  const generator = new CodeGenerator(options)
  return generator.generate(parsed)
}

/**
 * Read a GitLab CI YAML file and convert it to TypeScript ConfigBuilder code.
 *
 * This function reads a `.gitlab-ci.yml` file, parses it, and generates equivalent
 * TypeScript code using the ConfigBuilder API. Optionally, it can write the generated
 * code to an output file.
 *
 * @param yamlPath - Path to the `.gitlab-ci.yml` file to import
 * @param outputPath - Optional path where to write the generated TypeScript file
 * @param options - Optional configuration for the code generation
 * @param options.asExtendedConfig - Generate as an extended config function (default: false)
 * @returns The generated TypeScript code as a string
 *
 * @example
 * ```ts
 * import { importYamlFile } from '@noxify/gitlab-ci-builder'
 *
 * // Import and get the generated code
 * const tsCode = await importYamlFile('.gitlab-ci.yml')
 * console.log(tsCode)
 * ```
 *
 * @example
 * ```ts
 * // Import and write to output file
 * await importYamlFile('.gitlab-ci.yml', 'src/gitlab-ci.ts')
 * console.log('Generated TypeScript config at src/gitlab-ci.ts')
 * ```
 *
 * @example
 * ```ts
 * // Generate as extended config function
 * const tsCode = await importYamlFile(
 *   '.gitlab-ci.yml',
 *   'src/gitlab-ci-extended.ts',
 *   { asExtendedConfig: true }
 * )
 * ```
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
