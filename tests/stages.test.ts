import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - stages", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  describe("stages()", () => {
    it("should add stages", () => {
      config.stages("build", "test", "deploy")
      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build", "test", "deploy"])
    })

    it("should ensure unique stages", () => {
      config.stages("build", "test")
      config.stages("test", "deploy")
      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build", "test", "deploy"])
    })

    it("should return this for chaining", () => {
      const result = config.stages("build")
      expect(result).toBe(config)
    })
  })

  describe("addStage()", () => {
    it("should add a single stage", () => {
      config.addStage("build")
      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build"])
    })

    it("should be chainable", () => {
      const result = config.addStage("build").addStage("test")
      expect(result).toBe(config)
      expect(config.getPlainObject().stages).toEqual(["build", "test"])
    })
  })
})
