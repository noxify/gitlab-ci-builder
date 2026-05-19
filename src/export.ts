import fs from "node:fs/promises"

import type { ConfigBuilder } from "."
import type { PipelineOutput } from "./model"
import { serializeToYaml } from "./serializer"

/**
 * Convert a ConfigBuilder instance or PipelineOutput to a YAML string.
 *
 * This function accepts either a ConfigBuilder instance or a plain PipelineOutput object
 * and converts it to a valid GitLab CI YAML configuration string.
 *
 * @param config - A ConfigBuilder instance or PipelineOutput object to convert
 * @returns YAML string representation of the pipeline configuration
 *
 * @example
 * ```ts
 * import { ConfigBuilder, toYaml } from '@noxify/gitlab-ci-builder'
 *
 * const config = new ConfigBuilder()
 *   .stages('build', 'test')
 *   .job('build', { stage: 'build', script: 'npm run build' })
 *
 * const yaml = toYaml(config)
 * console.log(yaml)
 * ```
 *
 * @example
 * ```ts
 * // Using with PipelineOutput object
 * const pipeline = {
 *   stages: ['build', 'test'],
 *   jobs: {
 *     build: { stage: 'build', script: 'npm run build' }
 *   }
 * }
 *
 * const yaml = toYaml(pipeline)
 * ```
 */
export function toYaml(config: ConfigBuilder | PipelineOutput): string {
  // Check if it's a ConfigBuilder instance
  if (
    typeof config === "object" &&
    "toYaml" in config &&
    typeof config.toYaml === "function"
  ) {
    return config.toYaml()
  }

  // Otherwise treat as PipelineOutput
  return serializeToYaml(config as PipelineOutput)
}

/**
 * Write a ConfigBuilder instance or PipelineOutput to a YAML file.
 *
 * This function writes a GitLab CI configuration to a file in YAML format.
 * It accepts either a ConfigBuilder instance or a plain PipelineOutput object.
 *
 * @param filePath - Destination file path for the YAML output (e.g., '.gitlab-ci.yml')
 * @param config - A ConfigBuilder instance or PipelineOutput object to serialize
 * @param options - Optional write options
 * @param options.encoding - File encoding (default: 'utf8')
 *
 * @example
 * ```ts
 * import { ConfigBuilder, writeYamlFile } from '@noxify/gitlab-ci-builder'
 *
 * const config = new ConfigBuilder()
 *   .stages('build', 'test')
 *   .job('build', { stage: 'build', script: 'npm run build' })
 *
 * await writeYamlFile('.gitlab-ci.yml', config)
 * ```
 *
 * @example
 * ```ts
 * // Using with PipelineOutput object
 * const pipeline = {
 *   stages: ['build', 'test'],
 *   jobs: {
 *     build: { stage: 'build', script: 'npm run build' }
 *   }
 * }
 *
 * await writeYamlFile('.gitlab-ci.yml', pipeline, { encoding: 'utf-8' })
 * ```
 */
export async function writeYamlFile(
  filePath: string,
  config: ConfigBuilder | PipelineOutput,
  options?: { encoding?: BufferEncoding }
) {
  // Check if it's a ConfigBuilder instance
  if (
    typeof config === "object" &&
    "writeYamlFile" in config &&
    typeof config.writeYamlFile === "function"
  ) {
    return config.writeYamlFile(filePath, options)
  }

  // Otherwise use toYaml
  const content = toYaml(config as PipelineOutput)
  await fs.writeFile(filePath, content, {
    encoding: options?.encoding ?? "utf-8",
  })
}

export default { toYaml, writeYamlFile }
