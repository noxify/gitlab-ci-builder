import yaml from "js-yaml"

import { referenceTag } from "./yaml-parser/reference"

const CUSTOM_SCHEMA = yaml.DEFAULT_SCHEMA.extend({ explicit: [referenceTag] })

/**
 * Parse YAML content with GitLab CI custom tags.
 *
 * Supports both single-document and multi-document YAML files.
 * Handles GitLab-specific YAML tags like !reference.
 *
 * @param yamlContent - The YAML string to parse
 * @returns Parsed YAML as a JavaScript object
 *
 * @example
 * ```ts
 * import { parseYaml } from '@noxify/gitlab-ci-builder'
 *
 * const yaml = `
 * stages:
 *   - build
 *   - test
 * build:
 *   stage: build
 *   script: npm run build
 * `
 *
 * const parsed = parseYaml(yaml)
 * console.log(parsed.stages) // ['build', 'test']
 * ```
 */
export function parseYaml(yamlContent: string): Record<string, unknown> {
  // Try to load all documents
  const documents = yaml.loadAll(yamlContent, null, { schema: CUSTOM_SCHEMA })

  // If there's only one document, return it directly
  if (documents.length === 1) {
    return documents[0] as Record<string, unknown>
  }

  // For multi-document YAML, merge all documents
  // This is common in GitLab CI component templates
  const merged: Record<string, unknown> = {}

  for (const doc of documents) {
    if (doc && typeof doc === "object") {
      Object.assign(merged, doc)
    }
  }

  return merged
}
