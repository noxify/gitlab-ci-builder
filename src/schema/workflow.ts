import { z } from "zod"

/**
 * Workflow rule schema (extended)
 */
export const WorkflowRuleSchema = z
  .object({
    if: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesif" })
      .optional(),
    when: z
      .enum(["always", "never"])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#ruleswhen" })
      .optional(),
    changes: z
      .union([
        z.string(),
        z.array(z.string()),
        z.object({
          paths: z.array(z.string()),
          compare_to: z.string().optional(),
        }),
      ])
      .meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#ruleschanges",
      })
      .optional(),
    exists: z
      .union([
        z.array(z.string()),
        z.object({
          paths: z.array(z.string()),
          project: z.string().optional(),
          ref: z.string().optional(),
        }),
      ])
      .meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#rulesexists",
      })
      .optional(),
    variables: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#rulesvariables",
      })
      .optional(),
    auto_cancel: z
      .object({
        on_new_commit: z
          .enum(["conservative", "interruptible", "none"])
          .optional(),
        on_job_failure: z.enum(["all", "none"]).optional(),
      })
      .meta({
        description:
          "@see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_new_commit",
      })
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#workflowrules" })

export const WorkflowRulesSchema = z.array(WorkflowRuleSchema)

/**
 * Workflow configuration
 * Controls when pipelines should be created
 */
export const WorkflowSchema = z
  .object({
    name: z
      .string()
      .meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#workflowname",
      })
      .optional(),
    rules: WorkflowRulesSchema.optional().default([]),
    auto_cancel: z
      .object({
        on_new_commit: z
          .enum(["conservative", "interruptible", "none"])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_new_commit",
          })
          .optional(),
        on_job_failure: z
          .enum(["all", "none"])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_job_failure",
          })
          .optional(),
      })
      .meta({
        description:
          "@see https://docs.gitlab.com/ci/yaml/#workflowauto_cancel",
      })
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#workflow" })

export type WorkflowRule = z.infer<typeof WorkflowRuleSchema>
export type WorkflowRules = z.infer<typeof WorkflowRulesSchema>
export type Workflow = z.infer<typeof WorkflowSchema>
