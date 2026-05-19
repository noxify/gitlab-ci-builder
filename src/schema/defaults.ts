import { z } from "zod"

import { ImageSchema, ScriptSchema, ServicesSchema, TagsSchema } from "./base"
import { ArtifactsSchema, CacheSchema } from "./job"

/**
 * Default configuration that applies to all jobs
 */
export const DefaultsSchema = z
  .object({
    image: ImageSchema.optional(),
    services: ServicesSchema.optional(),
    before_script: ScriptSchema.meta({
      description: "@see https://docs.gitlab.com/ci/yaml/#before_script",
    }).optional(),
    after_script: ScriptSchema.meta({
      description: "@see https://docs.gitlab.com/ci/yaml/#after_script",
    }).optional(),
    tags: TagsSchema.optional(),
    artifacts: ArtifactsSchema.optional(),
    cache: z.union([CacheSchema, z.array(CacheSchema)]).optional(),
    retry: z
      .union([
        z.number(),
        z.object({
          max: z.number(),
          when: z.union([z.string(), z.array(z.string())]).optional(),
        }),
      ])
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#retry" })
      .optional(),
    timeout: z
      .string()
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#timeout" })
      .optional(),
    interruptible: z
      .boolean()
      .meta({
        description: "@see https://docs.gitlab.com/ci/yaml/#interruptible",
      })
      .optional(),
    id_tokens: z
      .record(
        z.string(),
        z.object({
          aud: z.union([z.string(), z.array(z.string())]),
        })
      )
      .optional(),
    hooks: z
      .object({
        pre_get_sources_script: z
          .union([z.string(), z.array(z.string())])
          .meta({
            description:
              "@see https://docs.gitlab.com/ci/yaml/#hookspre_get_sources_script",
          })
          .optional(),
      })
      .meta({ description: "@see https://docs.gitlab.com/ci/yaml/#hooks" })
      .optional(),
  })
  .meta({ description: "@see https://docs.gitlab.com/ee/ci/yaml/#default" })

export type Defaults = z.infer<typeof DefaultsSchema>
