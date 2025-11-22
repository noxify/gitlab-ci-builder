import { z } from "zod"

import type { Script } from "./base"
import {
  ExtendsInputSchema,
  ExtendsSchema,
  ImageSchema,
  JobVariablesSchema,
  ScriptSchema,
  ServicesSchema,
  TagsSchema,
} from "./base"
import { JobInputsSchema, PagesConfigSchema } from "./spec"
import { StepsSchema } from "./steps"

/**
 * Rules definition for job execution conditions
 */
export const RuleSchema = z
  .object({
    if: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesif" })
      .optional(),
    when: z
      .enum(["on_success", "on_failure", "always", "never", "manual", "delayed"])
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
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#ruleschanges" })
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
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesexists" })
      .optional(),
    allow_failure: z
      .union([
        z.boolean(),
        z.object({
          exit_codes: z.union([z.number(), z.array(z.number())]),
        }),
      ])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesallow_failure" })
      .optional(),
    variables: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesvariables" })
      .optional(),
    start_in: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#when" })
      .optional(),
    needs: z
      .array(
        z.union([
          z.string(),
          z.object({
            job: z.string(),
            artifacts: z.boolean().optional(),
            optional: z.boolean().optional(),
          }),
        ]),
      )
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesneeds" })
      .optional(),
    interruptible: z
      .boolean()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rulesinterruptible" })
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#rules" })

export const RulesSchema = z.array(RuleSchema)

export type Rule = z.infer<typeof RuleSchema>
export type Rules = z.infer<typeof RulesSchema>

/**
 * Artifacts definition
 */
export const ArtifactsSchema = z
  .object({
    name: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsname" })
      .optional(),
    paths: z
      .array(z.string())
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactspaths" })
      .optional(),
    exclude: z
      .array(z.string())
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsexclude" })
      .optional(),
    expose_as: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsexpose_as" })
      .optional(),
    untracked: z
      .boolean()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsuntracked" })
      .optional(),
    when: z
      .enum(["on_success", "on_failure", "always"])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactswhen" })
      .optional(),
    expire_in: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsexpire_in" })
      .optional(),
    access: z
      .enum(["none", "developer", "all"])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsaccess" })
      .optional(),
    reports: z
      .object({
        accessibility: z.string().optional(),
        annotations: z
          .string()
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsannotations",
          })
          .optional(),
        junit: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsjunit",
          })
          .optional(),
        browser_performance: z
          .string()
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsbrowser_performance",
          })
          .optional(),
        coverage_report: z
          .object({
            coverage_format: z.enum(["cobertura", "jacoco"]),
            path: z.string(),
          })
          .optional(),
        codequality: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscodequality-starter",
          })
          .optional(),
        dotenv: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdotenv",
          })
          .optional(),
        lsif: z.union([z.string(), z.array(z.string())]).optional(),
        sast: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportssast-ultimate",
          })
          .optional(),
        dependency_scanning: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdependency_scanning-ultimate",
          })
          .optional(),
        container_scanning: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscontainer_scanning-ultimate",
          })
          .optional(),
        dast: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdast-ultimate",
          })
          .optional(),
        license_scanning: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportslicense_scanning-ultimate",
          })
          .optional(),
        requirements: z.union([z.string(), z.array(z.string())]).optional(),
        secret_detection: z.union([z.string(), z.array(z.string())]).optional(),
        metrics: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsmetrics",
          })
          .optional(),
        terraform: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsterraform",
          })
          .optional(),
        cyclonedx: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportscyclonedx",
          })
          .optional(),
        load_performance: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsload_performance",
          })
          .optional(),
        repository_xray: z.union([z.string(), z.array(z.string())]).optional(),
      })
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifactsreports" })
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#artifacts" })

export type Artifacts = z.infer<typeof ArtifactsSchema>

/**
 * Cache definition
 */
export const CacheSchema = z
  .object({
    key: z
      .union([
        z.string(),
        z.object({
          files: z
            .array(z.string())
            .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachekeyfiles" })
            .optional(),
          files_commits: z
            .array(z.string())
            .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachekeyfiles_commits" })
            .optional(),
          prefix: z
            .string()
            .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachekeyprefix" })
            .optional(),
        }),
      ])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachekey" })
      .optional(),
    paths: z
      .array(z.string())
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachepaths" })
      .optional(),
    untracked: z
      .boolean()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cacheuntracked" })
      .optional(),
    when: z
      .enum(["on_success", "on_failure", "always"])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachewhen" })
      .optional(),
    policy: z
      .enum(["pull", "push", "pull-push"])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachepolicy" })
      .optional(),
    unprotect: z
      .boolean()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cacheunprotect" })
      .optional(),
    fallback_keys: z
      .array(z.string())
      .max(5)
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cachefallback_keys" })
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#cache" })

export type Cache = z.infer<typeof CacheSchema>

/**
 * Base job definition (shared fields)
 */
export const BaseJobSchema = z.object({
  stage: z.string().meta({ description: "@see https://docs.gitlab.com/ci/yaml/#stage" }).optional(),
  script: ScriptSchema.optional(),
  run: StepsSchema.optional(),
  before_script: ScriptSchema.meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#before_script",
  }).optional(),
  after_script: ScriptSchema.meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#after_script",
  }).optional(),
  image: ImageSchema.optional(),
  services: ServicesSchema.optional(),
  tags: TagsSchema.optional(),
  variables: JobVariablesSchema.optional(),
  rules: RulesSchema.optional(),
  extends: ExtendsInputSchema.meta({
    description: "@see https://docs.gitlab.com/ci/yaml/#extends",
  }).optional(),
  artifacts: ArtifactsSchema.optional(),
  cache: z.union([CacheSchema, z.array(CacheSchema)]).optional(),
  needs: z
    .union([
      z.string(),
      z.array(
        z.union([
          z.string(),
          z.object({
            job: z.string(),
            artifacts: z.boolean().optional(),
            optional: z.boolean().optional(),
          }),
          z.object({
            job: z.string(),
            pipeline: z.string(),
            artifacts: z.boolean().optional(),
          }),
          z.object({
            job: z.string(),
            project: z.string(),
            ref: z.string(),
            artifacts: z.boolean().optional(),
          }),
        ]),
      ),
      z.object({
        pipeline: z.string(),
        optional: z.boolean().optional(),
      }),
    ])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#needs" })
    .optional(),
  dependencies: z
    .array(z.string())
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#dependencies" })
    .optional(),
  allow_failure: z
    .union([z.boolean(), z.object({ exit_codes: z.union([z.number(), z.array(z.number())]) })])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#allow_failure" })
    .optional(),
  when: z
    .enum(["on_success", "on_failure", "always", "never", "manual", "delayed"])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#when" })
    .optional(),
  timeout: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#timeout" })
    .optional(),
  retry: z
    .union([
      z.number(),
      z.object({ max: z.number(), when: z.union([z.string(), z.array(z.string())]).optional() }),
    ])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#retry" })
    .optional(),
  parallel: z
    .union([z.number(), z.object({ matrix: z.array(z.record(z.string(), z.array(z.any()))) })])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#parallel" })
    .optional(),
  interruptible: z
    .boolean()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#interruptible" })
    .optional(),
  resource_group: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#resource_group" })
    .optional(),
  environment: z
    .union([
      z.string(),
      z.object({
        name: z
          .string()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environmentname" }),
        url: z
          .string()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environmenturl" })
          .optional(),
        on_stop: z
          .string()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environmenton_stop" })
          .optional(),
        auto_stop_in: z
          .string()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environmentauto_stop_in" })
          .optional(),
        deployment_tier: z.string().optional(),
        action: z
          .enum(["start", "prepare", "stop", "verify", "access"])
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environmentaction" })
          .optional(),
        kubernetes: z
          .object({
            agent: z.string().optional(),
            namespace: z.string().optional(),
            flux_resource_path: z.string().optional(),
            managed_resources: z
              .object({
                enabled: z.boolean().optional(),
              })
              .optional(),
            dashboard: z
              .object({
                namespace: z.string().optional(),
                flux_resource_path: z.string().optional(),
              })
              .optional(),
          })
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environmentkubernetes" })
          .optional(),
      }),
    ])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#environment" })
    .optional(),
  release: z
    .object({
      tag_name: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releasetag_name" }),
      tag_message: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releasetag_message" })
        .optional(),
      description: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releasedescription" })
        .optional(),
      name: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releasename" })
        .optional(),
      ref: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releaseref" })
        .optional(),
      milestones: z
        .array(z.string())
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releasemilestones" })
        .optional(),
      released_at: z
        .string()
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releasereleased_at" })
        .optional(),
      assets: z
        .object({
          links: z.array(
            z.object({
              name: z.string(),
              url: z.string(),
              filepath: z.string().optional(),
              link_type: z.enum(["runbook", "package", "image", "other"]).optional(),
            }),
          ),
        })
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#releaseassets" })
        .optional(),
    })
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#release" })
    .optional(),
  trigger: z
    .union([
      z.string(),
      z.object({
        project: z
          .string()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerproject" }),
        branch: z
          .string()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerbranch" })
          .optional(),
        strategy: z
          .enum(["depend", "mirror"])
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerstrategy" })
          .optional(),
        forward: z
          .object({
            yaml_variables: z
              .boolean()
              .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerforward" })
              .optional(),
            pipeline_variables: z
              .boolean()
              .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerforward" })
              .optional(),
          })
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerforward" })
          .optional(),
      }),
      z.object({
        include: z
          .any()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerinclude" }),
        strategy: z
          .enum(["depend", "mirror"])
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerstrategy" })
          .optional(),
        forward: z
          .object({
            yaml_variables: z
              .boolean()
              .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerforward" })
              .optional(),
            pipeline_variables: z
              .boolean()
              .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerforward" })
              .optional(),
          })
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#triggerforward" })
          .optional(),
      }),
    ])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#trigger" })
    .optional(),
  id_tokens: z
    .record(
      z.string(),
      z.object({
        aud: z.union([z.string(), z.array(z.string())]),
      }),
    )
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#id_tokens" })
    .optional(),
  secrets: z
    .record(
      z.string(),
      z.object({
        vault: z
          .union([
            z.string(),
            z.object({
              engine: z.object({
                name: z.string(),
                path: z.string(),
              }),
              path: z.string(),
              field: z.string(),
            }),
          ])
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#secretsvault" })
          .optional(),
        gcp_secret_manager: z
          .object({
            name: z.string(),
            version: z.union([z.string(), z.number()]).optional(),
          })
          .optional(),
        azure_key_vault: z
          .object({
            name: z.string(),
            version: z.string().optional(),
          })
          .optional(),
        aws_secrets_manager: z
          .union([
            z.string(),
            z.object({
              secret_id: z.string(),
              version_id: z.string().optional(),
              version_stage: z.string().optional(),
              region: z.string().optional(),
              role_arn: z.string().optional(),
              role_session_name: z.string().optional(),
              field: z.string().optional(),
            }),
          ])
          .optional(),
        file: z
          .boolean()
          .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#secretsfile" })
          .optional(),
        token: z.string().optional(),
      }),
    )
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#secrets" })
    .optional(),
  hooks: z
    .object({
      pre_get_sources_script: z
        .union([z.string(), z.array(z.string())])
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#hookspre_get_sources_script" })
        .optional(),
    })
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#hooks" })
    .optional(),
  inherit: z
    .object({
      default: z
        .union([z.boolean(), z.array(z.string())])
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#inheritdefault" })
        .optional(),
      variables: z
        .union([z.boolean(), z.array(z.string())])
        .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#inheritvariables" })
        .optional(),
    })
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#inherit" })
    .optional(),
  coverage: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#coverage" })
    .optional(),
  manual_confirmation: z
    .string()
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#manual_confirmation" })
    .optional(),
  inputs: JobInputsSchema.optional(),
  pages: PagesConfigSchema.optional(),
  only: z
    .union([
      z.array(z.string()),
      z.object({
        refs: z.array(z.string()).optional(),
        kubernetes: z.enum(["active"]).optional(),
        variables: z.array(z.string()).optional(),
        changes: z.array(z.string()).optional(),
      }),
    ])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#only--except" })
    .optional(),
  except: z
    .union([
      z.array(z.string()),
      z.object({
        refs: z.array(z.string()).optional(),
        kubernetes: z.enum(["active"]).optional(),
        variables: z.array(z.string()).optional(),
        changes: z.array(z.string()).optional(),
      }),
    ])
    .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#only--except" })
    .optional(),
})

export type BaseJob = z.infer<typeof BaseJobSchema>

/**
 * Job definition (input from user - can have string or array extends)
 */
export const JobDefinitionInputSchema = BaseJobSchema

export type JobDefinitionInput = z.infer<typeof JobDefinitionInputSchema>

/**
 * Job definition parsing schema (applies transforms for normalization)
 */
export const JobDefinitionParseSchema = BaseJobSchema.extend({
  extends: ExtendsSchema.optional(),
})

/**
 * Job definition (normalized internally - extends always array)
 */
export const JobDefinitionNormalizedSchema = BaseJobSchema.extend({
  extends: z.array(z.string()).optional(),
})

export type JobDefinitionNormalized = z.infer<typeof JobDefinitionNormalizedSchema>

/**
 * Job definition for output (extends can be string or array)
 */
export const JobDefinitionOutputSchema = BaseJobSchema

export type JobDefinitionOutput = z.infer<typeof JobDefinitionOutputSchema>

/**
 * Template definition is the same as job definition
 * but stored with a name starting with a dot
 */
export const TemplateDefinitionInputSchema = JobDefinitionInputSchema
export const TemplateDefinitionNormalizedSchema = JobDefinitionNormalizedSchema

export type TemplateDefinitionInput = z.infer<typeof TemplateDefinitionInputSchema>
export type TemplateDefinitionNormalized = z.infer<typeof TemplateDefinitionNormalizedSchema>

/**
 * Helper to normalize extends field
 */
export function normalizeExtends(def: JobDefinitionInput): JobDefinitionNormalized {
  if (!def.extends) {
    return def as JobDefinitionNormalized
  }

  return {
    ...def,
    extends: Array.isArray(def.extends) ? def.extends : [def.extends],
  }
}

/**
 * Helper to extract script as array
 */
export function normalizeScript(script: Script | undefined): string[] {
  if (!script) return []
  return Array.isArray(script) ? script : [script]
}
