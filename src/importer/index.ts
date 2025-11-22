import fs from "fs/promises"

import type { CodeGeneratorOptions } from "./ts-factory/generator"
import { parseYaml } from "./parser"
import { CodeGenerator } from "./ts-factory/generator"

/**
 * Options for YAML to TypeScript conversion
 */
export type ImportOptions = CodeGeneratorOptions

/**
 * Convert a GitLab CI YAML string to TypeScript Config builder code
 *
 * @param yamlContent - The YAML string to parse and convert
 * @param options - Optional configuration for the conversion
 * @returns TypeScript code as a string
 */
export function fromYaml(yamlContent: string, options?: ImportOptions): string {
  const parsed = parseYaml(yamlContent)
  const generator = new CodeGenerator(options)
  return generator.generate(parsed)
}

/**
 * Read a GitLab CI YAML file and convert it to TypeScript Config builder code
 *
 * @param yamlPath - Path to the `.gitlab-ci.yml` file to import
 * @param outputPath - Optional path where to write the generated TypeScript file
 * @param options - Optional configuration for the conversion
 * @returns The generated TypeScript code
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
