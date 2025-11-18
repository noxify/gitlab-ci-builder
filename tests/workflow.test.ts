import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - workflow", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  it("should set workflow rules", () => {
    config.workflow({
      rules: [
        {
          if: '$CI_PIPELINE_SOURCE == "merge_request_event"',
          when: "always",
        },
      ],
    })
    const result = config.getPlainObject()

    expect(result.workflow?.rules).toHaveLength(1)
    expect(result.workflow?.rules[0]).toMatchObject({
      if: '$CI_PIPELINE_SOURCE == "merge_request_event"',
      when: "always",
    })
  })

  it("should merge workflow rules", () => {
    config.workflow({
      rules: [{ if: "$CI_COMMIT_BRANCH", when: "always" }],
    })
    config.workflow({
      rules: [{ if: "$CI_PIPELINE_SOURCE", when: "never" }],
    })
    const result = config.getPlainObject()

    expect(result.workflow?.rules).toHaveLength(2)
  })

  it("should return this for chaining", () => {
    const result = config.workflow({ rules: [] })
    expect(result).toBe(config)
  })
})
