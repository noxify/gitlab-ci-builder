import { Type } from "js-yaml"

/**
 * Custom YAML type for !reference tags - String representation
 * Converts !reference [.template, script] to string literal for TypeScript generation
 */
export const referenceTag = new Type("!reference", {
  kind: "sequence",
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  construct: (data: unknown[]) => `!reference [${(data || []).join(", ")}]`,
})

/**
 * Custom YAML type for !reference tags - Object representation
 * Stores reference as an object with kind and path for resolution
 */
export const referenceTagResolvable = new Type("!reference", {
  kind: "sequence",
  construct: (data: unknown[]) => ({
    kind: "reference",
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    path: data || [],
  }),
})
