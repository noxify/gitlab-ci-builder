import yaml from "js-yaml"

/**
 * Custom YAML type for !reference tags
 * Converts !reference [.template, script] to string literal
 */
export const referenceTag = new yaml.Type("!reference", {
  kind: "sequence",
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  construct: (data: unknown[]) => `!reference [${(data || []).join(", ")}]`,
})
