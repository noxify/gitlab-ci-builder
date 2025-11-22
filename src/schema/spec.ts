import { z } from "zod"

/**
 * Base input definition for spec.inputs
 */
export const BaseInputSchema = z.object({
  type: z
    .enum(["string", "number", "boolean", "array"])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#specinputstype" })
    .optional(),
  description: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#specinputsdescription" })
    .optional(),
  options: z
    .array(z.union([z.string(), z.number(), z.boolean()]))
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#specinputsoptions" })
    .optional(),
  regex: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#specinputsregex" })
    .optional(),
  default: z
    .any()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#specinputsdefault" })
    .optional(),
  rules: z.array(z.object({})).optional(),
})

export type BaseInput = z.infer<typeof BaseInputSchema>

/**
 * Spec configuration - Pipeline inputs
 */
export const SpecSchema = z
  .object({
    inputs: z.record(z.string(), z.union([BaseInputSchema, z.null()])).optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#spec" })

export type Spec = z.infer<typeof SpecSchema>

/**
 * Job inputs definition (different from spec.inputs - default is required)
 */
export const JobInputSchema = BaseInputSchema.extend({
  default: z.any(),
}).required({ default: true })

export const JobInputsSchema = z
  .record(z.string(), JobInputSchema)
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#inputs" })

export type JobInput = z.infer<typeof JobInputSchema>
export type JobInputs = z.infer<typeof JobInputsSchema>

/**
 * Pages configuration
 */
export const PagesConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      path_prefix: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#pagespath_prefix" })
        .optional(),
      expire_in: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#pagesexpire_in" })
        .optional(),
      publish: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#pagespublish" })
        .optional(),
    }),
  ])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#pages" })

export type PagesConfig = z.infer<typeof PagesConfigSchema>
