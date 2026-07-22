import { existsSync } from "node:fs"
import path from "node:path"

import type { Rule } from "../schema/job"

/**
 * Context for rule evaluation
 */
export interface RuleContext {
  variables: Record<string, string>
  changes?: string[]
  mergeRequestLabels?: string[]
  branch?: string
  tag?: string
  /** Base directory for resolving file paths in exists rules */
  basePath?: string
}

/**
 * Result of rule evaluation
 * - match: Rule matched, job should run with specified when
 * - no_match: Rule was evaluated but didn't match, try next rule
 * - skip_unevaluable: Rule cannot be evaluated (e.g., exists without basePath, changes without git)
 */
export type RuleResult =
  | { type: "match"; when?: string }
  | { type: "no_match" }
  | { type: "skip_unevaluable" }

/**
 * Evaluates GitLab CI rules against a given context
 */
export class RuleEvaluator {
  /**
   * Evaluate a single rule against the context
   *
   * @returns RuleResult with one of three types:
   * - `match`: Rule matched, job should run with specified when clause
   * - `no_match`: Rule was evaluated but conditions didn't match, try next rule
   * - `skip_unevaluable`: Rule cannot be evaluated (e.g., exists without basePath, changes without git)
   */
  evaluateRule(rule: Rule, context: RuleContext): RuleResult {
    // Check exists condition - evaluate if basePath is provided
    if (rule.exists) {
      if (!context.basePath) {
        // No basePath provided, cannot evaluate filesystem - skip this rule
        return { type: "skip_unevaluable" }
      }

      // Handle different exists formats
      let paths: string[]
      if (typeof rule.exists === "string") {
        paths = [rule.exists]
      } else if (Array.isArray(rule.exists)) {
        paths = rule.exists
      } else {
        // Object format with paths, project, ref
        ;({ paths } = rule.exists)
      }

      // Check if at least one file exists
      const anyExists = paths.some((pattern) => {
        const interpolatedPath = RuleEvaluator.interpolateVariables(
          pattern,
          context.variables
        )
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const absolutePath = path.resolve(context.basePath!, interpolatedPath)
        return existsSync(absolutePath)
      })

      // If no files exist, this rule doesn't match - try next rule
      if (!anyExists) {
        return { type: "no_match" }
      }

      // Files exist - now check if there's an if condition
      if (!rule.if) {
        // No if condition, just exists - rule matches
        return { type: "match", when: rule.when }
      }

      // Fall through to check if condition below
    }

    // Check changes condition - skip rule in simulation (we don't have git context)
    if (rule.changes) {
      // In simulation, we cannot determine which files changed
      // Skip this rule and try the next one
      return { type: "skip_unevaluable" }
    }

    // If no if condition and no exists, rule matches
    if (!rule.if) {
      return { type: "match", when: rule.when }
    }

    // Simple variable check: $VAR_NAME == "value" or $VAR_NAME =~ /pattern/
    const ifCondition = rule.if.trim()

    // Handle negation
    const isNegated = ifCondition.startsWith("!")
    const condition = isNegated ? ifCondition.slice(1).trim() : ifCondition

    let matches = this.evaluateCondition(condition, context)

    if (isNegated) {
      matches = !matches
    }

    // If condition matches, rule matches with its when clause
    // If condition doesn't match, try next rule
    if (matches) {
      return { type: "match", when: rule.when }
    }

    return { type: "no_match" }
  }

  /**
   * Interpolate variables in a string (e.g., $VAR_NAME or ${VAR_NAME})
   */
  private static interpolateVariables(
    str: string,
    variables: Record<string, string>
  ): string {
    // Replace ${VAR_NAME} and $VAR_NAME with actual values
    return str.replaceAll(
      /\$\{?(?<varName>\w+)\}?/gu,
      (_match, varName) => variables[varName as string] ?? ""
    )
  }

  /**
   * Evaluate if condition string
   */
  private evaluateCondition(condition: string, context: RuleContext): boolean {
    const logicalResult = this.evaluateLogicalCondition(condition, context)
    if (logicalResult !== null) {
      return logicalResult
    }

    const varToVarResult = RuleEvaluator.evaluateVariableToVariableCondition(
      condition,
      context
    )
    if (varToVarResult !== null) {
      return varToVarResult
    }

    const varToValueResult = RuleEvaluator.evaluateVariableToValueCondition(
      condition,
      context
    )
    if (varToValueResult !== null) {
      return varToValueResult
    }

    const regexResult = RuleEvaluator.evaluateRegexCondition(condition, context)
    if (regexResult !== null) {
      return regexResult
    }

    const variableExistsResult = RuleEvaluator.evaluateVariableExistsCondition(
      condition,
      context
    )
    if (variableExistsResult !== null) {
      return variableExistsResult
    }

    const specialVarResult = RuleEvaluator.evaluateSpecialVariableCondition(
      condition,
      context
    )
    if (specialVarResult !== null) {
      return specialVarResult
    }

    const pipelineSourceResult = RuleEvaluator.evaluatePipelineSourceCondition(
      condition,
      context
    )
    if (pipelineSourceResult !== null) {
      return pipelineSourceResult
    }

    return false
  }

  private evaluateLogicalCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    if (condition.includes(" && ")) {
      const parts = condition.split(" && ")
      return parts.every((part) => this.evaluateCondition(part.trim(), context))
    }

    if (condition.includes(" || ")) {
      const parts = condition.split(" || ")
      return parts.some((part) => this.evaluateCondition(part.trim(), context))
    }

    return null
  }

  private static evaluateVariableToVariableCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    const varToVarMatch = /\$(?<var1>\w+)\s*==\s*\$(?<var2>\w+)/u.exec(
      condition
    )
    if (varToVarMatch) {
      const { var1, var2 } = varToVarMatch.groups ?? {}
      if (!var1 || !var2) {
        return false
      }
      return context.variables[var1] === context.variables[var2]
    }

    const varToVarNotMatch = /\$(?<var1>\w+)\s*!=\s*\$(?<var2>\w+)/u.exec(
      condition
    )
    if (!varToVarNotMatch) {
      return null
    }

    const { var1, var2 } = varToVarNotMatch.groups ?? {}
    if (!var1 || !var2) {
      return false
    }
    return context.variables[var1] !== context.variables[var2]
  }

  private static evaluateVariableToValueCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    const exactMatch = /\$(?<varName>\w+)\s*==\s*["'](?<value>.+?)["']/u.exec(
      condition
    )
    if (exactMatch) {
      const { varName, value } = exactMatch.groups ?? {}
      if (!varName || !value) {
        return false
      }
      return context.variables[varName] === value
    }

    const notMatch = /\$(?<varName>\w+)\s*!=\s*["'](?<value>.+?)["']/u.exec(
      condition
    )
    if (!notMatch) {
      return null
    }

    const { varName, value } = notMatch.groups ?? {}
    if (!varName || !value) {
      return false
    }
    return context.variables[varName] !== value
  }

  private static evaluateRegexCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    const regexMatch =
      /\$(?<varName>\w+)\s*=~\s*\/(?<pattern>.+?)\/(?<flags>[i]?)/u.exec(
        condition
      )
    if (regexMatch) {
      const { varName, pattern, flags } = regexMatch.groups ?? {}
      if (!varName || !pattern) {
        return false
      }
      const value = context.variables[varName] ?? ""
      const regex = new RegExp(pattern, flags)
      return regex.test(value)
    }

    const regexNotMatch =
      /\$(?<varName>\w+)\s*!~\s*\/(?<pattern>.+?)\/(?<flags>[i]?)/u.exec(
        condition
      )
    if (!regexNotMatch) {
      return null
    }

    const { varName, pattern, flags } = regexNotMatch.groups ?? {}
    if (!varName || !pattern) {
      return false
    }
    const value = context.variables[varName] ?? ""
    const regex = new RegExp(pattern, flags)
    return !regex.test(value)
  }

  private static evaluateVariableExistsCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    const varExists = /^\$(?<varName>\w+)$/u.exec(condition)
    if (!varExists) {
      return null
    }

    const { varName } = varExists.groups ?? {}
    if (!varName) {
      return false
    }

    const value = context.variables[varName]
    return (
      value !== undefined && value !== "" && value !== "false" && value !== "0"
    )
  }

  private static evaluateSpecialVariableCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    if (condition === "$CI_COMMIT_BRANCH") {
      return !!context.branch
    }

    if (condition === "$CI_COMMIT_TAG") {
      return !!context.tag
    }

    if (condition === "$CI_MERGE_REQUEST_ID") {
      return !!context.mergeRequestLabels
    }

    return null
  }

  private static evaluatePipelineSourceCondition(
    condition: string,
    context: RuleContext
  ): boolean | null {
    const pipelineSource =
      /\$CI_PIPELINE_SOURCE\s*==\s*["'](?<source>.+?)["']/u.exec(condition)
    if (!pipelineSource) {
      return null
    }

    const { source } = pipelineSource.groups ?? {}
    if (source === "merge_request_event") {
      return !!context.mergeRequestLabels
    }

    return false
  }

  /**
   * Evaluate all rules and return the final when clause
   */
  evaluateRules(
    rules: Rule[] | undefined,
    context: RuleContext
  ): { shouldRun: boolean; when: string } {
    if (!rules || rules.length === 0) {
      return { shouldRun: true, when: "on_success" }
    }

    let hasEvaluableRules = false

    for (const rule of rules) {
      const result = this.evaluateRule(rule, context)

      // Skip rules that cannot be evaluated (exists without basePath, changes without git)
      if (result.type === "skip_unevaluable") {
        continue
      }

      // We found at least one evaluable rule (either matched or didn't match)
      hasEvaluableRules = true

      // Rule didn't match, try next rule
      if (result.type === "no_match") {
        continue
      }

      // Rule matched
      const when = result.when ?? "on_success"

      if (when === "never") {
        return { shouldRun: false, when: "never" }
      }

      return { shouldRun: true, when }
    }

    // If all rules were unevaluable (exists/changes), assume job should run
    // This is the GitLab default behavior when rules can't be checked
    if (!hasEvaluableRules) {
      return { shouldRun: true, when: "on_success" }
    }

    // All evaluable rules were checked but none matched - job doesn't run
    return { shouldRun: false, when: "never" }
  }
}
