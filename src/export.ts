import fs from "fs/promises"

import type { ConfigBuilder } from "."
import type { PipelineOutput } from "./model"
import { serializeToYaml } from "./serializer"

/**
 * Convert a ConfigBuilder instance or PipelineOutput to a YAML string.
 *
 * @param config - A ConfigBuilder instance or PipelineOutput object.
 * @returns YAML string representation of the pipeline.
 */
export function toYaml(config: ConfigBuilder | PipelineOutput): string {
  // Check if it's a ConfigBuilder instance
  if (typeof config === "object" && "toYaml" in config && typeof config.toYaml === "function") {
    return config.toYaml()
  }

  // Otherwise treat as PipelineOutput
  return serializeToYaml(config as PipelineOutput)
}

/**
 * Write a ConfigBuilder instance or PipelineOutput to a YAML file.
 *
 * @param filePath - Destination file path for the YAML output.
 * @param config - A ConfigBuilder instance or PipelineOutput object to serialize.
 * @param options - Optional write options (currently only `encoding`).
 */
export async function writeYamlFile(
  filePath: string,
  config: ConfigBuilder | PipelineOutput,
  options?: { encoding?: BufferEncoding },
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
  await fs.writeFile(filePath, content, { encoding: options?.encoding ?? "utf8" })
}

export default { toYaml, writeYamlFile }
