// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { RuleEvaluator } from "../../src/simulation/rule-evaluator"

describe("RuleEvaluator - && Operator", () => {
  const evaluator = new RuleEvaluator()

  it("should evaluate AND operator - both true", () => {
    const result = evaluator.evaluateRule(
      {
        if: '$VAR1 == "a" && $VAR2 == "b"',
        when: "always",
      },
      {
        variables: { VAR1: "a", VAR2: "b" },
        branch: "main",
      }
    )

    expect(result).toStrictEqual({ type: "match", when: "always" })
  })

  it("should evaluate AND operator - first false", () => {
    const result = evaluator.evaluateRule(
      {
        if: '$VAR1 == "x" && $VAR2 == "b"',
        when: "always",
      },
      {
        variables: { VAR1: "a", VAR2: "b" },
        branch: "main",
      }
    )

    expect(result).toStrictEqual({ type: "no_match" })
  })

  it("should evaluate AND operator - second false", () => {
    const result = evaluator.evaluateRule(
      {
        if: '$VAR1 == "a" && $VAR2 == "x"',
        when: "always",
      },
      {
        variables: { VAR1: "a", VAR2: "b" },
        branch: "main",
      }
    )

    expect(result).toStrictEqual({ type: "no_match" })
  })

  it("should evaluate variable comparison AND regex pattern", () => {
    const result = evaluator.evaluateRule(
      {
        if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $CI_COMMIT_MESSAGE =~ /release/",
        when: "always",
      },
      {
        variables: {
          CI_COMMIT_BRANCH: "main",
          CI_DEFAULT_BRANCH: "main",
          CI_COMMIT_MESSAGE: "",
        },
        branch: "main",
      }
    )

    // Should NOT match because CI_COMMIT_MESSAGE doesn't contain "release"
    expect(result).toStrictEqual({ type: "no_match" })
  })

  it("should evaluate variable-to-variable comparison", () => {
    const result = evaluator.evaluateRule(
      {
        if: "$CI_COMMIT_REF_SLUG == $CI_DEFAULT_BRANCH",
      },
      {
        variables: {
          CI_COMMIT_REF_SLUG: "main",
          CI_DEFAULT_BRANCH: "main",
        },
        branch: "main",
      }
    )

    // Should match with implicit when: on_success
    expect(result).toStrictEqual({ type: "match", when: undefined })
  })
})
