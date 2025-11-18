type WhenOptions = "on_success" | "on_failure" | "never" | "always" | "manual" | "delayed"

/**
 * @see https://docs.gitlab.com/ee/ci/yaml/#when
 */
type WhenDefinition = WhenOptions

export type { WhenOptions, WhenDefinition }
