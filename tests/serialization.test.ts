import { beforeEach, describe, expect, it } from "vitest"

import type { GitLabCi } from "../src"
import { Config } from "../src/config"

describe("Config - serialization", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  describe("getPlainObject()", () => {
    it("should return flattened configuration with jobs at root", () => {
      config.stages("build", "test")
      config.variable("NODE_ENV", "production")
      config.job("build", { stage: "build", script: ["npm run build"] })
      config.job("test", { stage: "test", script: ["npm test"] })

      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build", "test"])
      expect(result.variables?.NODE_ENV).toBe("production")
      expect(result.jobs?.build).toBeDefined()
      expect(result.jobs?.test).toBeDefined()
    })

    it("should not include empty stages array", () => {
      const result = config.getPlainObject()
      expect(result.stages).toBeUndefined()
    })

    it("should not include empty variables object", () => {
      const result = config.getPlainObject()
      expect(result.variables).toBeUndefined()
    })

    it("should not include empty workflow", () => {
      const result = config.getPlainObject()
      expect(result.workflow).toBeUndefined()
    })
  })

  describe("toJSON()", () => {
    it("should return same as getPlainObject", () => {
      config.stages("build")
      config.job("test", { script: ["echo test"] })

      const plain = config.getPlainObject()
      const json = config.toJSON()

      expect(json).toEqual(plain)
    })

    it("should be called by JSON.stringify", () => {
      config.variable("TEST", "value")
      config.job("build", { script: ["npm run build"] })

      const serialized = JSON.parse(JSON.stringify(config)) as GitLabCi

      expect(serialized.variables?.TEST).toBe("value")
      expect(serialized.jobs?.build).toBeDefined()
    })
  })

  describe("RegExp serialization", () => {
    it("should serialize RegExp in job rules", () => {
      config.job("test", {
        script: ["echo test"],
        rules: [
          {
            if: /^feature\/.*/.toString(),
            when: "always",
          },
        ],
      })

      const serialized = JSON.parse(JSON.stringify(config)) as GitLabCi
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(serialized.jobs!.test!.rules?.[0]?.if).toBe("/^feature\\/.*/")
    })
  })
})
