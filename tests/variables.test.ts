import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - variables", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  describe("variable()", () => {
    it("should set a single variable", () => {
      config.variable("NODE_ENV", "production")
      const result = config.getPlainObject()

      expect(result.variables?.NODE_ENV).toBe("production")
    })

    it("should support different value types", () => {
      config.variable("STRING_VAR", "value")
      config.variable("NUMBER_VAR", 42)
      config.variable("BOOLEAN_VAR", true)
      config.variable("UNDEFINED_VAR", undefined)

      const result = config.getPlainObject()

      expect(result.variables?.STRING_VAR).toBe("value")
      expect(result.variables?.NUMBER_VAR).toBe(42)
      expect(result.variables?.BOOLEAN_VAR).toBe(true)
      expect(result.variables?.UNDEFINED_VAR).toBeUndefined()
    })

    it("should return this for chaining", () => {
      const result = config.variable("KEY", "value")
      expect(result).toBe(config)
    })
  })

  describe("variables()", () => {
    it("should set multiple variables at once", () => {
      config.variables({
        NODE_ENV: "production",
        DEBUG: true,
        PORT: 3000,
      })
      const result = config.getPlainObject()

      expect(result.variables).toMatchObject({
        NODE_ENV: "production",
        DEBUG: true,
        PORT: 3000,
      })
    })

    it("should merge with existing variables", () => {
      config.variable("FIRST", "value1")
      config.variables({
        SECOND: "value2",
        THIRD: "value3",
      })
      const result = config.getPlainObject()

      expect(result.variables).toMatchObject({
        FIRST: "value1",
        SECOND: "value2",
        THIRD: "value3",
      })
    })

    it("should return this for chaining", () => {
      const result = config.variables({ KEY: "value" })
      expect(result).toBe(config)
    })
  })

  describe("getVariable()", () => {
    it("should get global variable", () => {
      config.variable("GLOBAL_VAR", "global-value")
      expect(config.getVariable("any-job", "GLOBAL_VAR")).toBe("global-value")
    })

    it("should get job-specific variable", () => {
      config.variable("VAR", "global")
      config.job("test-job", {
        script: ["echo test"],
        variables: { VAR: "job-specific" },
      })

      expect(config.getVariable("test-job", "VAR")).toBe("job-specific")
    })

    it("should return undefined for non-existent variable", () => {
      expect(config.getVariable("test-job", "NON_EXISTENT")).toBeUndefined()
    })
  })
})
