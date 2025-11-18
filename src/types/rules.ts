import type { NeedsDefinition } from "./needs"
import type { VariablesDefinition } from "./variables"
import type { WhenOptions } from "./when"

/**
 * @see https://docs.gitlab.com/ee/ci/yaml/#rules
 */
type RulesDefinition<T = WhenOptions> = {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesif
   */
  if?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
   */
  changes?: string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesexists
   */
  exists?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
   */
  when?: T
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
   */
  allow_failure?: boolean
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
   */
  needs?: NeedsDefinition
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
   */
  variables?: VariablesDefinition
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
   */
  interruptible?: boolean
}[]

export type { RulesDefinition }
