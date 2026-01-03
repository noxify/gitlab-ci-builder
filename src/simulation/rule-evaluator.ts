import { existsSync } from "node:fs"
import { resolve } from "node:path"

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
        paths = rule.exists.paths
      }

      // Check if at least one file exists
      const anyExists = paths.some((pattern) => {
        const interpolatedPath = this.interpolateVariables(pattern, context.variables)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const absolutePath = resolve(context.basePath!, interpolatedPath)
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
  private interpolateVariables(str: string, variables: Record<string, string>): string {
    // Replace ${VAR_NAME} and $VAR_NAME with actual values
    return str.replace(/\$\{?(\w+)\}?/g, (_match, varName) => {
      return variables[varName as string] ?? ""
    })
  }

  /**
   * Evaluate if condition string
   */
  private evaluateCondition(condition: string, context: RuleContext): boolean {
    // Handle && operator (AND logic)
    if (condition.includes(" && ")) {
      const parts = condition.split(" && ")
      return parts.every((part) => this.evaluateCondition(part.trim(), context))
    }

    // Handle || operator (OR logic)
    if (condition.includes(" || ")) {
      const parts = condition.split(" || ")
      return parts.some((part) => this.evaluateCondition(part.trim(), context))
    }

    // $VAR_NAME == $OTHER_VAR (variable-to-variable comparison)
    const varToVarMatchRegex = /\$(\w+)\s*==\s*\$(\w+)/
    const varToVarMatch = varToVarMatchRegex.exec(condition)
    if (varToVarMatch) {
      const var1 = varToVarMatch[1]
      const var2 = varToVarMatch[2]
      if (!var1 || !var2) return false
      return context.variables[var1] === context.variables[var2]
    }

    // $VAR_NAME != $OTHER_VAR (variable-to-variable not equal)
    const varToVarNotMatchRegex = /\$(\w+)\s*!=\s*\$(\w+)/
    const varToVarNotMatch = varToVarNotMatchRegex.exec(condition)
    if (varToVarNotMatch) {
      const var1 = varToVarNotMatch[1]
      const var2 = varToVarNotMatch[2]
      if (!var1 || !var2) return false
      return context.variables[var1] !== context.variables[var2]
    }

    // $VAR_NAME == "value"
    const exactMatchRegex = /\$(\w+)\s*==\s*["'](.+?)["']/
    const exactMatch = exactMatchRegex.exec(condition)
    if (exactMatch) {
      const varName = exactMatch[1]
      const value = exactMatch[2]
      if (!varName || !value) return false
      return context.variables[varName] === value
    }

    // $VAR_NAME != "value"
    const notMatchRegex = /\$(\w+)\s*!=\s*["'](.+?)["']/
    const notMatch = notMatchRegex.exec(condition)
    if (notMatch) {
      const varName = notMatch[1]
      const value = notMatch[2]
      if (!varName || !value) return false
      return context.variables[varName] !== value
    }

    // $VAR_NAME =~ /pattern/i (regex match, case insensitive)
    const regexMatchRegex = /\$(\w+)\s*=~\s*\/(.+?)\/([i]?)/
    const regexMatch = regexMatchRegex.exec(condition)
    if (regexMatch) {
      const varName = regexMatch[1]
      const pattern = regexMatch[2]
      const flags = regexMatch[3]
      if (!varName || !pattern) return false
      const value = context.variables[varName] ?? ""
      const regex = new RegExp(pattern, flags)
      return regex.test(value)
    }

    // $VAR_NAME !~ /pattern/i (regex not match)
    const regexNotMatchRegex = /\$(\w+)\s*!~\s*\/(.+?)\/([i]?)/
    const regexNotMatch = regexNotMatchRegex.exec(condition)
    if (regexNotMatch) {
      const varName = regexNotMatch[1]
      const pattern = regexNotMatch[2]
      const flags = regexNotMatch[3]
      if (!varName || !pattern) return false
      const value = context.variables[varName] ?? ""
      const regex = new RegExp(pattern, flags)
      return !regex.test(value)
    }

    // $VAR_NAME (variable exists and is truthy)
    const varExistsRegex = /^\$(\w+)$/
    const varExists = varExistsRegex.exec(condition)
    if (varExists) {
      const varName = varExists[1]
      if (!varName) return false
      const value = context.variables[varName]
      return value !== undefined && value !== "" && value !== "false" && value !== "0"
    }

    // $CI_COMMIT_BRANCH (special variables)
    if (condition === "$CI_COMMIT_BRANCH" && context.branch) {
      return true
    }

    if (condition === "$CI_COMMIT_TAG" && context.tag) {
      return true
    }

    // $CI_MERGE_REQUEST_ID (merge request check)
    if (condition === "$CI_MERGE_REQUEST_ID") {
      return !!context.mergeRequestLabels
    }

    // $CI_PIPELINE_SOURCE == "merge_request_event"
    const pipelineSourceRegex = /\$CI_PIPELINE_SOURCE\s*==\s*["'](.+?)["']/
    const pipelineSource = pipelineSourceRegex.exec(condition)
    if (pipelineSource) {
      const [, source] = pipelineSource
      if (source === "merge_request_event") {
        return !!context.mergeRequestLabels
      }
      // For other sources, assume they don't match in simulation
      return false
    }

    // Default: assume condition doesn't match
    return false
  }

  /**
   * Evaluate all rules and return the final when clause
   */
  evaluateRules(
    rules: Rule[] | undefined,
    context: RuleContext,
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
