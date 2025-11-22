import yaml from "js-yaml"

import { referenceTag } from "./yaml-parser/reference"

const CUSTOM_SCHEMA = yaml.DEFAULT_SCHEMA.extend({ explicit: [referenceTag] })

/**
 * Parse YAML content with GitLab CI custom tags
 */
export function parseYaml(yamlContent: string): Record<string, unknown> {
  return yaml.load(yamlContent, { schema: CUSTOM_SCHEMA }) as Record<string, unknown>
}
