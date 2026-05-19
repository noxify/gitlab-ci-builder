import { z } from "zod"

/**
 * Step name pattern
 */
export const StepNameSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/u)

/**
 * Named strings for environment variables
 */
export const StepNamedStringsSchema = z.record(StepNameSchema, z.string())

/**
 * Named values for inputs/outputs
 */
export const StepNamedValuesSchema = z.record(
  StepNameSchema,
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.any()),
    z.object({}),
  ])
)

/**
 * Git reference for steps
 */
export const StepGitReferenceSchema = z.object({
  git: z.object({
    url: z.string(),
    rev: z.string(),
    dir: z.string().optional(),
    file: z.string().optional(),
  }),
})

/**
 * OCI reference for steps
 */
export const StepOciReferenceSchema = z.object({
  oci: z.object({
    registry: z.string(),
    repository: z.string(),
    tag: z.string(),
    dir: z.string().optional(),
    file: z.string().optional(),
  }),
})

/**
 * Exec command
 */
export const StepExecSchema = z.object({
  command: z.array(z.string()).min(1),
  work_dir: z.string().optional(),
})

/**
 * Step definition (recursive type)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StepSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    // Referenced step
    z.object({
      name: StepNameSchema,
      env: StepNamedStringsSchema.optional(),
      inputs: StepNamedValuesSchema.optional(),
      step: z.union([
        z.string(),
        StepGitReferenceSchema,
        StepOciReferenceSchema,
      ]),
    }),
    // Sequence of steps
    z.object({
      env: StepNamedStringsSchema.optional(),
      run: z.array(StepSchema),
      outputs: StepNamedValuesSchema.optional(),
      delegate: z.string().optional(),
    }),
    // Action
    z.object({
      name: StepNameSchema,
      env: StepNamedStringsSchema.optional(),
      inputs: StepNamedValuesSchema.optional(),
      action: z.string().min(1),
    }),
    // Script
    z.object({
      name: StepNameSchema,
      env: StepNamedStringsSchema.optional(),
      script: z.string().min(1),
    }),
    // Exec
    z.object({
      env: StepNamedStringsSchema.optional(),
      exec: StepExecSchema,
    }),
  ])
)

export const StepsSchema = z.array(StepSchema)

export type Step = z.infer<typeof StepSchema>
export type Steps = z.infer<typeof StepsSchema>
