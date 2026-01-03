import { describe, expect, it } from "vitest"

import { RuleEvaluator } from "../../src/simulation/rule-evaluator"

describe("RuleEvaluator - != operator", () => {
  const evaluator = new RuleEvaluator()

  it("should evaluate != operator - not equal", () => {
    const result = evaluator.evaluateRule(
      {
        if: "$CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH",
        when: "never",
      },
      {
        variables: {
          CI_COMMIT_BRANCH: "main",
          CI_DEFAULT_BRANCH: "develop",
        },
        branch: "main",
      },
    )

    // Should match because "main" != "develop"
    expect(result).toEqual({ type: "match", when: "never" })
  })

  it("should evaluate != operator - equal (no match)", () => {
    const result = evaluator.evaluateRule(
      {
        if: "$CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH",
        when: "never",
      },
      {
        variables: {
          CI_COMMIT_BRANCH: "main",
          CI_DEFAULT_BRANCH: "main",
        },
        branch: "main",
      },
    )

    // Should NOT match because "main" == "main"
    expect(result).toEqual({ type: "no_match" })
  })

  it("should evaluate rules sequence with multiple operators", () => {
    const rules = [
      { if: "$JOB_DISABLED =~ /true/i", when: "never" as const },
      { if: "$CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH", when: "never" as const },
      { if: "$CI_COMMIT_REF_SLUG == $CI_DEFAULT_BRANCH" }, // no when = on_success
    ]

    const context = {
      variables: {
        JOB_DISABLED: "false",
        CI_COMMIT_BRANCH: "main",
        CI_DEFAULT_BRANCH: "main",
        CI_COMMIT_REF_SLUG: "main",
      },
      branch: "main" as string | undefined,
    }

    const result = evaluator.evaluateRules(rules, context)

    // Should run with on_success
    expect(result).toEqual({ shouldRun: true, when: "on_success" })
  })
})
