import { z } from "zod"

import { RulesSchema } from "./job"

/**
 * Inputs for parametrized includes
 */
export const InputsSchema = z
  .record(z.string(), z.any())
  .meta({ description: "@see https://docs.gitlab.com/ci/inputs/" })

/**
 * Local include
 */
export const LocalIncludeSchema = z.object({
  local: z.string().meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#includelocal",
  }),
  rules: RulesSchema.optional(),
  inputs: InputsSchema.optional(),
})

/**
 * Remote include
 */
export const RemoteIncludeSchema = z
  .object({
    remote: z.string().url(),
    rules: RulesSchema.optional(),
    inputs: InputsSchema.optional(),
    integrity: z
      .string()
      .regex(/^sha256-[A-Za-z0-9+/]{43}=$/u)
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#includeremote" })

/**
 * Project include
 */
export const ProjectIncludeSchema = z.object({
  project: z.string().meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#includeproject",
  }),
  file: z
    .union([z.string(), z.array(z.string())])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#includefile" }),
  ref: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#includeref" })
    .optional(),
  rules: RulesSchema.optional(),
  inputs: InputsSchema.optional(),
})

/**
 * Template include
 */
export const TemplateIncludeSchema = z.object({
  template: z.string().meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#includetemplate",
  }),
  rules: RulesSchema.optional(),
  inputs: InputsSchema.optional(),
})

/**
 * Component include
 */
export const ComponentIncludeSchema = z.object({
  component: z.string().meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#includecomponent",
  }),
  inputs: InputsSchema.optional(),
  rules: RulesSchema.optional(),
})

/**
 * Include entry (discriminated union)
 */
export const IncludeEntrySchema = z.union([
  LocalIncludeSchema,
  RemoteIncludeSchema,
  ProjectIncludeSchema,
  TemplateIncludeSchema,
  ComponentIncludeSchema,
])

export type IncludeEntry = z.infer<typeof IncludeEntrySchema>

/**
 * Include input (accepts strings or objects)
 * Strings are normalized to local or remote based on URL pattern
 */
export const IncludeInputSchema = z
  .union([z.string(), IncludeEntrySchema])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#include" })

export type IncludeInput = z.infer<typeof IncludeInputSchema>

/**
 * Include schema with normalization - converts strings to local/remote objects
 */
export const IncludeSchema = IncludeInputSchema.transform(
  (input): IncludeEntry => {
    if (typeof input === "string") {
      // Check if it's a URL
      if (/^https?:\/\//iu.test(input)) {
        return { remote: input } satisfies IncludeEntry
      }
      return { local: input } satisfies IncludeEntry
    }
    return input
  }
)

/**
 * Helper to normalize include input to IncludeEntry
 */
export function normalizeInclude(input: IncludeInput): IncludeEntry {
  if (typeof input === "string") {
    // Check if it's a URL
    if (/^https?:\/\//iu.test(input)) {
      return { remote: input }
    }
    return { local: input }
  }
  return input
}
