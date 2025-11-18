import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - chaining", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  it("should support fluent API", () => {
    const result = config
      .stages("build", "test", "deploy")
      .variable("NODE_ENV", "production")
      .defaults({ image: "node:22" })
      .workflow({ rules: [{ if: "$CI_COMMIT_BRANCH", when: "always" }] })
      .job("build", { stage: "build", script: ["npm run build"] })
      .job("test", { stage: "test", script: ["npm test"] })

    expect(result).toBe(config)

    const plain = config.getPlainObject()
    expect(plain.stages).toEqual(["build", "test", "deploy"])
    expect(plain.variables?.NODE_ENV).toBe("production")
    expect(plain.default?.image).toBe("node:22")
    expect(plain.jobs?.build).toBeDefined()
    expect(plain.jobs?.test).toBeDefined()
  })
})
