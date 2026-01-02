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
}

/**
 * Evaluates GitLab CI rules against a given context
 */
export class RuleEvaluator {
  /**
   * Evaluate a single rule against the context
   */
  evaluateRule(rule: Rule, context: RuleContext): { matches: boolean; when?: string } {
    // If no if condition, rule matches
    if (!rule.if) {
      return { matches: true, when: rule.when }
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

    return { matches, when: rule.when }
  }

  /**
   * Evaluate if condition string
   */
  private evaluateCondition(condition: string, context: RuleContext): boolean {
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

    for (const rule of rules) {
      const result = this.evaluateRule(rule, context)

      if (result.matches) {
        const when = result.when ?? "on_success"

        if (when === "never") {
          return { shouldRun: false, when: "never" }
        }

        return { shouldRun: true, when }
      }
    }

    // No rule matched - job doesn't run
    return { shouldRun: false, when: "never" }
  }
}
