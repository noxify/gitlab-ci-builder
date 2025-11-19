/**
 * @see https://docs.gitlab.com/ee/ci/yaml/#needs
 */
type NeedsDefinition =
  | string[]
  | {
      job: string
      /**
       * @see https://docs.gitlab.com/ee/ci/yaml/#artifact-downloads-with-needs
       */
      artifacts?: boolean
      /**
       * @see https://docs.gitlab.com/ee/ci/yaml/#needsoptional
       */
      optional?: boolean
    }[]
  | {
      /**
       * @see https://docs.gitlab.com/ee/ci/yaml/#complex-trigger-syntax-for-multi-project-pipelines
       */
      pipeline: string
      /**
       * @see https://docs.gitlab.com/ee/ci/yaml/#needsoptional
       */
      optional?: boolean
    }

export type { NeedsDefinition }
