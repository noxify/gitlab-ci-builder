import { z } from "zod"

/**
 * Variable value types supported by GitLab CI
 */
export const VariableValueSchema = z.union([z.string(), z.number(), z.boolean(), z.undefined()])

export type VariableValue = z.infer<typeof VariableValueSchema>

/**
 * Extended variable definition for global variables
 * Supports value/options/description/expand
 */
export const GlobalVariableSchema = z
  .union([
    VariableValueSchema,
    z.object({
      value: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variablesvalue" }),
      options: z
        .array(z.string())
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variablesoptions" })
        .optional(),
      description: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variablesdescription" })
        .optional(),
      expand: z
        .boolean()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variablesexpand" })
        .optional(),
    }),
  ])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variables" })

export type GlobalVariable = z.infer<typeof GlobalVariableSchema>

/**
 * Extended variable definition for job variables
 * Supports value/expand (no options/description)
 */
export const JobVariableSchema = z
  .union([
    VariableValueSchema,
    z.object({
      value: z.string(),
      expand: z
        .boolean()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variablesexpand" })
        .optional(),
    }),
  ])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#variables" })

export type JobVariable = z.infer<typeof JobVariableSchema>

/**
 * Variables definition - key-value pairs (legacy - simple values)
 */
export const VariablesSchema = z.record(z.string(), VariableValueSchema)

export type Variables = z.infer<typeof VariablesSchema>

/**
 * Global variables with extended options
 */
export const GlobalVariablesSchema = z.record(z.string(), GlobalVariableSchema)

export type GlobalVariables = z.infer<typeof GlobalVariablesSchema>

/**
 * Job variables with extended options
 */
export const JobVariablesSchema = z.record(z.string(), JobVariableSchema)

export type JobVariables = z.infer<typeof JobVariablesSchema>

/**
 * Script command - string or array of strings
 */
export const ScriptSchema = z
  .union([z.string(), z.array(z.string())])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#script" })

export type Script = z.infer<typeof ScriptSchema>

/**
 * Extends - single name or array of names
 * Normalized internally to always be an array
 */
export const ExtendsInputSchema = z.union([z.string(), z.array(z.string())])

export type ExtendsInput = z.infer<typeof ExtendsInputSchema>

/**
 * Stage name
 */
export const StageSchema = z.string().min(1)

export type Stage = z.infer<typeof StageSchema>

/**
 * Job/Template name
 * Templates start with a dot
 */
export const JobNameSchema = z.string().min(1)
export const TemplateNameSchema = z.string().regex(/^\./, "Template name must start with a dot")

export type JobName = z.infer<typeof JobNameSchema>
export type TemplateName = z.infer<typeof TemplateNameSchema>

/**
 * Tags for runner selection
 */
export const TagsSchema = z
  .array(z.string())
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#tags" })

export type Tags = z.infer<typeof TagsSchema>

/**
 * Pull policy for images
 */
export const PullPolicySchema = z
  .union([
    z.enum(["always", "never", "if-not-present"]),
    z.array(z.enum(["always", "never", "if-not-present"])),
  ])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#imagepull_policy" })

export type PullPolicy = z.infer<typeof PullPolicySchema>

/**
 * Image definition - string or object with extended options
 */
export const ImageSchema = z
  .union([
    z.string(),
    z.object({
      name: z.string().meta({ description: "@see https://docs.gitlab.com/ci/yaml/#imagename" }),
      entrypoint: z
        .array(z.string())
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#imageentrypoint" })
        .optional(),
      docker: z
        .object({
          platform: z.string().optional(),
          user: z.string().optional(),
        })
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#imagedocker" })
        .optional(),
      kubernetes: z
        .object({
          user: z.union([z.string(), z.number()]).optional(),
        })
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#imagekubernetes" })
        .optional(),
      pull_policy: PullPolicySchema.meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#imagepull_policy",
      }).optional(),
    }),
  ])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#image" })

export type Image = z.infer<typeof ImageSchema>

/**
 * Services definition with extended options
 */
export const ServiceSchema = z
  .union([
    z.string(),
    z.object({
      name: z.string().meta({ description: "@see https://docs.gitlab.com/ci/yaml/#servicesname" }),
      alias: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#servicesalias" })
        .optional(),
      entrypoint: z
        .array(z.string())
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#servicesentrypoint" })
        .optional(),
      command: z
        .array(z.string())
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#servicescommand" })
        .optional(),
      docker: z
        .object({
          platform: z.string().optional(),
          user: z.string().optional(),
        })
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#servicesdocker" })
        .optional(),
      kubernetes: z
        .object({
          user: z.union([z.string(), z.number()]).optional(),
        })
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#imagekubernetes" })
        .optional(),
      pull_policy: PullPolicySchema.meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#servicespull_policy",
      }).optional(),
      variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
  ])
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#services" })

export const ServicesSchema = z.array(ServiceSchema)

export type Service = z.infer<typeof ServiceSchema>
export type Services = z.infer<typeof ServicesSchema>
