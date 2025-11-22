import { z } from "zod"

/**
 * Policy for handling missing extends targets
 */
export const MissingExtendsPolicySchema = z.enum(["warn", "error", "ignore"])

export type MissingExtendsPolicy = z.infer<typeof MissingExtendsPolicySchema>

/**
 * Global options that apply to all jobs unless overridden at job level
 */
export const GlobalOptionsSchema = z.object({
  /** If false, extends merging is disabled globally. Job-level setting overrides. Default: true */
  mergeExtends: z.boolean().optional().default(true),

  /** If true, jobs with same name are merged by default. Job-level setting overrides. Default: true */
  mergeExisting: z.boolean().optional().default(true),

  /** If true, only merge templates (names starting with .). Default: true */
  resolveTemplatesOnly: z.boolean().optional().default(true),

  /** If true, skip expensive validation checks (cycle detection, deep path scans). Default: false */
  performanceMode: z.boolean().optional().default(false),

  /** Policy for missing extends targets. Default: warn */
  missingExtendsPolicy: MissingExtendsPolicySchema.optional().default("warn"),
})

export type GlobalOptions = z.infer<typeof GlobalOptionsSchema>

/**
 * Options for job and template definitions
 */
export const JobOptionsSchema = z.object({
  /** If false, extends from parent templates/jobs will not be merged. Default: true */
  mergeExtends: z.boolean().optional(),

  /** If true, merge with existing job/template of same name. Default: true */
  mergeExisting: z.boolean().optional(),

  /** If true, treat as hidden template (prefix with dot). Default: false */
  hidden: z.boolean().optional(),

  /** If true, only merge templates (names starting with .). Default: true (inherits global) */
  resolveTemplatesOnly: z.boolean().optional(),

  /** Optional: mark job as remote for merge logic */
  remote: z.boolean().optional(),
})

export type JobOptions = z.infer<typeof JobOptionsSchema>

/**
 * Validation result metadata
 */
export const ValidationMetadataSchema = z.object({
  /** List of validation checks that were skipped (e.g., in performance mode) */
  skippedChecks: z.array(z.string()).optional().default([]),

  /** Warnings collected during processing */
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
        path: z.array(z.union([z.string(), z.number()])).optional(),
      }),
    )
    .optional()
    .default([]),
})

export type ValidationMetadata = z.infer<typeof ValidationMetadataSchema>
