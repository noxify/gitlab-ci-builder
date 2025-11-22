import { describe, expect, it } from "vitest"
import { z } from "zod"

import { ConfigBuilder } from "../../src"
import { isGitLabInterpolation, orInterpolation } from "../../src/schema/interpolation"

describe("GitLab CI Interpolation", () => {
  describe("isGitLabInterpolation", () => {
    it("should recognize $[[ ... ]] patterns", () => {
      expect(isGitLabInterpolation("$[[ inputs.stage ]]")).toBe(true)
      expect(isGitLabInterpolation("$[[ inputs.parallel_count ]]")).toBe(true)
      expect(isGitLabInterpolation("$[[ inputs.root_dir | expand_vars ]]")).toBe(true)
      expect(isGitLabInterpolation("$[[ CI_COMMIT_REF_NAME ]]")).toBe(true)
    })

    it("should recognize ${{ ... }} patterns", () => {
      expect(isGitLabInterpolation("${{ inputs.stage }}")).toBe(true)
      expect(isGitLabInterpolation("${{ inputs.count }}")).toBe(true)
    })

    it("should reject non-interpolation strings", () => {
      expect(isGitLabInterpolation("test")).toBe(false)
      expect(isGitLabInterpolation("$TEST")).toBe(false)
      expect(isGitLabInterpolation("inputs.stage")).toBe(false)
      expect(isGitLabInterpolation("[[ inputs.stage ]]")).toBe(false)
    })

    it("should reject non-string values", () => {
      expect(isGitLabInterpolation(123)).toBe(false)
      expect(isGitLabInterpolation(true)).toBe(false)
      expect(isGitLabInterpolation(null)).toBe(false)
      expect(isGitLabInterpolation(undefined)).toBe(false)
      expect(isGitLabInterpolation({})).toBe(false)
      expect(isGitLabInterpolation([])).toBe(false)
    })
  })

  describe("orInterpolation", () => {
    it("should accept valid values for number schema", () => {
      const schema = orInterpolation(z.number())

      expect(schema.safeParse(5).success).toBe(true)
      expect(schema.safeParse(0).success).toBe(true)
      expect(schema.safeParse(-10).success).toBe(true)
      expect(schema.safeParse("$[[ inputs.count ]]").success).toBe(true)
    })

    it("should reject invalid values for number schema", () => {
      const schema = orInterpolation(z.number())

      expect(schema.safeParse("not a number").success).toBe(false)
      expect(schema.safeParse("test").success).toBe(false)
      expect(schema.safeParse(true).success).toBe(false)
    })

    it("should accept valid values for enum schema", () => {
      const schema = orInterpolation(z.enum(["test", "deploy", "production"]))

      expect(schema.safeParse("test").success).toBe(true)
      expect(schema.safeParse("deploy").success).toBe(true)
      expect(schema.safeParse("production").success).toBe(true)
      expect(schema.safeParse("$[[ inputs.stage ]]").success).toBe(true)
    })

    it("should reject invalid values for enum schema", () => {
      const schema = orInterpolation(z.enum(["test", "deploy", "production"]))

      expect(schema.safeParse("invalid").success).toBe(false)
      expect(schema.safeParse("other").success).toBe(false)
      expect(schema.safeParse(123).success).toBe(false)
    })

    it("should accept valid values for array schema", () => {
      const schema = orInterpolation(z.array(z.string()))

      expect(schema.safeParse(["docker", "linux"]).success).toBe(true)
      expect(schema.safeParse([]).success).toBe(true)
      expect(schema.safeParse("$[[ inputs.tags ]]").success).toBe(true)
    })

    it("should reject invalid values for array schema", () => {
      const schema = orInterpolation(z.array(z.string()))

      expect(schema.safeParse("not an array").success).toBe(false)
      expect(schema.safeParse(123).success).toBe(false)
      expect(schema.safeParse({ key: "value" }).success).toBe(false)
    })

    it("should accept valid values for string schema", () => {
      const schema = orInterpolation(z.string())

      expect(schema.safeParse("test").success).toBe(true)
      expect(schema.safeParse("").success).toBe(true)
      expect(schema.safeParse("$[[ inputs.name ]]").success).toBe(true)
    })

    it("should work with complex union schemas", () => {
      const schema = orInterpolation(
        z.union([
          z.number(),
          z.object({
            matrix: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
          }),
        ]),
      )

      expect(schema.safeParse(5).success).toBe(true)
      expect(schema.safeParse({ matrix: [{ key: "value" }] }).success).toBe(true)
      expect(schema.safeParse("$[[ inputs.parallel ]]").success).toBe(true)
    })
  })

  describe("Integration with ConfigBuilder schemas", () => {
    it("should validate job with interpolated stage", () => {
      const config = new ConfigBuilder()

      // Should not throw with interpolation
      expect(() => {
        config.job("test-job", {
          stage: "$[[ inputs.stage ]]",
          script: ["echo test"],
        })
      }).not.toThrow()

      const result = config.finalize()
      expect(result.errors).toHaveLength(0)
      expect(result.pipeline.jobs?.["test-job"]?.stage).toBe("$[[ inputs.stage ]]")
    })

    it("should validate job with interpolated parallel count", () => {
      const config = new ConfigBuilder()

      expect(() => {
        config.job("parallel-job", {
          parallel: "$[[ inputs.count ]]",
          script: ["echo test"],
        })
      }).not.toThrow()

      const result = config.finalize()
      expect(result.errors).toHaveLength(0)
      expect(result.pipeline.jobs?.["parallel-job"]?.parallel).toBe("$[[ inputs.count ]]")
    })

    it("should validate job with interpolated tags", () => {
      const config = new ConfigBuilder()

      expect(() => {
        config.job("tagged-job", {
          tags: "$[[ inputs.tags ]]",
          script: ["echo test"],
        })
      }).not.toThrow()

      const result = config.finalize()
      expect(result.errors).toHaveLength(0)
      expect(result.pipeline.jobs?.["tagged-job"]?.tags).toBe("$[[ inputs.tags ]]")
    })

    it("should validate job with interpolated cache policy", () => {
      const config = new ConfigBuilder()

      expect(() => {
        config.job("cached-job", {
          cache: {
            key: "test",
            paths: [".cache"],
            policy: "$[[ inputs.cache_policy ]]",
          },
          script: ["echo test"],
        })
      }).not.toThrow()

      const result = config.finalize()
      expect(result.errors).toHaveLength(0)
      expect(result.pipeline.jobs?.["cached-job"]?.cache).toMatchObject({
        policy: "$[[ inputs.cache_policy ]]",
      })
    })
  })
})
