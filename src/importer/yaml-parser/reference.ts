import { defineSequenceTag } from "js-yaml"

/**
 * Custom YAML type for !reference tags - String representation
 * Converts !reference [.template, script] to string literal for TypeScript generation
 */
export const referenceTag = defineSequenceTag<unknown[], string>("!reference", {
  create: () => [],
  addItem: (carrier, item) => {
    carrier.push(item)
  },
  finalize: (carrier) => `!reference [${carrier.join(", ")}]`,
})

/**
 * Custom YAML type for !reference tags - Object representation
 * Stores reference as an object with kind and path for resolution
 */
export const referenceTagResolvable = defineSequenceTag<
  unknown[],
  { kind: string; path: unknown[] }
>("!reference", {
  create: () => [],
  addItem: (carrier, item) => {
    carrier.push(item)
  },
  finalize: (carrier) => ({
    kind: "reference",
    path: carrier,
  }),
})
