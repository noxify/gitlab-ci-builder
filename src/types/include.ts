import type { RulesDefinition } from "./rules"

/**
 * @see https://docs.gitlab.com/ee/ci/yaml/#include
 */

interface LocalInclude {
  local: string
  rules?: Pick<RulesDefinition[number], "if" | "changes" | "exists">[]
}

interface ProjectInclude {
  project: string
  file?: string
  ref?: string
  rules?: Pick<RulesDefinition[number], "if" | "changes" | "exists">[]
}

interface RemoteInclude {
  remote: string
  rules?: Pick<RulesDefinition[number], "if" | "changes" | "exists">[]
}

interface TemplateInclude {
  template: string
  rules?: Pick<RulesDefinition[number], "if" | "changes" | "exists">[]
}

interface ComponentInclude {
  component: string
  rules?: Pick<RulesDefinition[number], "if" | "changes" | "exists">[]
}

type IncludeEntry =
  | string
  | LocalInclude
  | ProjectInclude
  | RemoteInclude
  | TemplateInclude
  | ComponentInclude

type IncludeEntryOutput =
  | LocalInclude
  | ProjectInclude
  | RemoteInclude
  | TemplateInclude
  | ComponentInclude

type IncludeDefinition = IncludeEntry

type IncludeOutputDefinition = IncludeEntryOutput

export type {
  IncludeDefinition,
  IncludeOutputDefinition,
  IncludeEntry,
  LocalInclude,
  ProjectInclude,
  RemoteInclude,
  TemplateInclude,
  ComponentInclude,
}
