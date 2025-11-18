/**
 * @see https://docs.gitlab.com/ee/ci/yaml/#cache
 */
interface CacheDefinition {
  /**
   * @see https://docs.gitlab.com/ee/ci/yaml/#cachepaths
   */
  paths?: string[]
  /**
   * @see https://docs.gitlab.com/ee/ci/yaml/#cacheuntracked
   */
  untracked?: boolean
  /**
   * @see https://docs.gitlab.com/ee/ci/yaml/#cachepolicy
   */
  policy?: "pull-push" | "push" | "pull"
  /**
   * @see https://docs.gitlab.com/ee/ci/yaml/#cachekey
   */
  key?:
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ee/ci/yaml/#cachekeyfiles
         */
        files: [string] | [string, string]
        /**
         * @see https://docs.gitlab.com/ee/ci/yaml/#cachekeyprefix
         */
        prefix?: string
      }
  /** @see https://docs.gitlab.com/ee/ci/yaml#cacheunprotect */
  unprotect?: boolean
  /** @see https://docs.gitlab.com/ee/ci/yaml/#cachewhen */
  when?: "on_success" | "on_failure" | "always"
  /** @see https://docs.gitlab.com/ee/ci/yaml/#cachefallback_keys */
  fallback_keys?: string[]
}

export type { CacheDefinition }
