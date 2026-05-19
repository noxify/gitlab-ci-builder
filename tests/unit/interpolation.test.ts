// oxlint-disable eslint/no-template-curly-in-string
// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { ConfigBuilder } from "../../src"
import {
  isGitLabInterpolation,
  orInterpolation,
} from "../../src/schema/interpolation"

describe("GitLab CI Interpolation", () => {
  describe(isGitLabInterpolation, () => {
    it("should recognize $[[ ... ]] patterns", () => {
      expect(isGitLabInterpolation("$[[ inputs.stage ]]")).toBeTruthy()
      expect(isGitLabInterpolation("$[[ inputs.parallel_count ]]")).toBeTruthy()
      expect(
        isGitLabInterpolation("$[[ inputs.root_dir | expand_vars ]]")
      ).toBeTruthy()
      expect(isGitLabInterpolation("$[[ CI_COMMIT_REF_NAME ]]")).toBeTruthy()
    })

    it("should recognize ${{ ... }} patterns", () => {
      expect(isGitLabInterpolation("${{ inputs.stage }}")).toBeTruthy()
      expect(isGitLabInterpolation("${{ inputs.count }}")).toBeTruthy()
    })

    it("should reject non-interpolation strings", () => {
      expect(isGitLabInterpolation("test")).toBeFalsy()
      expect(isGitLabInterpolation("$TEST")).toBeFalsy()
      expect(isGitLabInterpolation("inputs.stage")).toBeFalsy()
      expect(isGitLabInterpolation("[[ inputs.stage ]]")).toBeFalsy()
    })

    it("should reject non-string values", () => {
      expect(isGitLabInterpolation(123)).toBeFalsy()
      expect(isGitLabInterpolation(true)).toBeFalsy()
      expect(isGitLabInterpolation(null)).toBeFalsy()
      expect(isGitLabInterpolation()).toBeFalsy()
      expect(isGitLabInterpolation({})).toBeFalsy()
      expect(isGitLabInterpolation([])).toBeFalsy()
    })
  })

  describe(orInterpolation, () => {
    it("should accept valid values for number schema", () => {
      const schema = orInterpolation(z.number())

      expect(schema.safeParse(5).success).toBeTruthy()
      expect(schema.safeParse(0).success).toBeTruthy()
      expect(schema.safeParse(-10).success).toBeTruthy()
      expect(schema.safeParse("$[[ inputs.count ]]").success).toBeTruthy()
    })

    it("should reject invalid values for number schema", () => {
      const schema = orInterpolation(z.number())

      expect(schema.safeParse("not a number").success).toBeFalsy()
      expect(schema.safeParse("test").success).toBeFalsy()
      expect(schema.safeParse(true).success).toBeFalsy()
    })

    it("should accept valid values for enum schema", () => {
      const schema = orInterpolation(z.enum(["test", "deploy", "production"]))

      expect(schema.safeParse("test").success).toBeTruthy()
      expect(schema.safeParse("deploy").success).toBeTruthy()
      expect(schema.safeParse("production").success).toBeTruthy()
      expect(schema.safeParse("$[[ inputs.stage ]]").success).toBeTruthy()
    })

    it("should reject invalid values for enum schema", () => {
      const schema = orInterpolation(z.enum(["test", "deploy", "production"]))

      expect(schema.safeParse("invalid").success).toBeFalsy()
      expect(schema.safeParse("other").success).toBeFalsy()
      expect(schema.safeParse(123).success).toBeFalsy()
    })

    it("should accept valid values for array schema", () => {
      const schema = orInterpolation(z.array(z.string()))

      expect(schema.safeParse(["docker", "linux"]).success).toBeTruthy()
      expect(schema.safeParse([]).success).toBeTruthy()
      expect(schema.safeParse("$[[ inputs.tags ]]").success).toBeTruthy()
    })

    it("should reject invalid values for array schema", () => {
      const schema = orInterpolation(z.array(z.string()))

      expect(schema.safeParse("not an array").success).toBeFalsy()
      expect(schema.safeParse(123).success).toBeFalsy()
      expect(schema.safeParse({ key: "value" }).success).toBeFalsy()
    })

    it("should accept valid values for string schema", () => {
      const schema = orInterpolation(z.string())

      expect(schema.safeParse("test").success).toBeTruthy()
      expect(schema.safeParse("").success).toBeTruthy()
      expect(schema.safeParse("$[[ inputs.name ]]").success).toBeTruthy()
    })

    it("should work with complex union schemas", () => {
      const schema = orInterpolation(
        z.union([
          z.number(),
          z.object({
            matrix: z.array(
              z.record(z.string(), z.union([z.string(), z.number()]))
            ),
          }),
        ])
      )

      expect(schema.safeParse(5).success).toBeTruthy()
      expect(
        schema.safeParse({ matrix: [{ key: "value" }] }).success
      ).toBeTruthy()
      expect(schema.safeParse("$[[ inputs.parallel ]]").success).toBeTruthy()
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

      const result = config.safeValidate()
      const pipeline = config.getPlainObject({ skipValidation: true })
      expect(result.errors).toHaveLength(0)
      expect(pipeline.jobs?.["test-job"]?.stage).toBe("$[[ inputs.stage ]]")
    })

    it("should validate job with interpolated parallel count", () => {
      const config = new ConfigBuilder()

      expect(() => {
        config.job("parallel-job", {
          parallel: "$[[ inputs.count ]]",
          script: ["echo test"],
        })
      }).not.toThrow()

      const result = config.safeValidate()
      const pipeline = config.getPlainObject({ skipValidation: true })
      expect(result.errors).toHaveLength(0)
      expect(pipeline.jobs?.["parallel-job"]?.parallel).toBe(
        "$[[ inputs.count ]]"
      )
    })

    it("should validate job with interpolated tags", () => {
      const config = new ConfigBuilder()

      expect(() => {
        config.job("tagged-job", {
          tags: "$[[ inputs.tags ]]",
          script: ["echo test"],
        })
      }).not.toThrow()

      const result = config.safeValidate()
      const pipeline = config.getPlainObject({ skipValidation: true })
      expect(result.errors).toHaveLength(0)
      expect(pipeline.jobs?.["tagged-job"]?.tags).toBe("$[[ inputs.tags ]]")
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

      const result = config.safeValidate()
      const pipeline = config.getPlainObject({ skipValidation: true })
      expect(result.errors).toHaveLength(0)
      expect(pipeline.jobs?.["cached-job"]?.cache).toMatchObject({
        policy: "$[[ inputs.cache_policy ]]",
      })
    })
  })
})
