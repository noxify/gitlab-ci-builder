import { describe, expect, it } from "vitest"
import { ZodError } from "zod"

import { ConfigBuilder } from "../../src/builder"

describe("ConfigBuilder - Zod Validation", () => {
  describe("workflow validation", () => {
    it("should accept valid workflow", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.workflow({
          rules: [{ if: "$CI_COMMIT_BRANCH == 'main'" }],
        }),
      ).not.toThrow()
    })

    it("should reject invalid workflow", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.workflow({
          // @ts-expect-error - Testing runtime validation
          rules: "invalid",
        }),
      ).toThrow(ZodError)
    })
  })

  describe("defaults validation", () => {
    it("should accept valid defaults", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.defaults({
          image: "node:18",
          before_script: ["npm install"],
        }),
      ).not.toThrow()
    })

    it("should reject invalid defaults", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.defaults({
          // @ts-expect-error - Testing runtime validation
          image: 123,
        }),
      ).toThrow(ZodError)
    })
  })

  describe("include validation", () => {
    it("should accept valid include", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.include({
          local: "templates/build.yml",
        }),
      ).not.toThrow()
    })

    it("should reject invalid include", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.include({
          // @ts-expect-error - Testing runtime validation
          invalid: "field",
        }),
      ).toThrow(ZodError)
    })

    it("should validate multiple includes", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.include([
          { local: "templates/build.yml" },
          // @ts-expect-error - Testing runtime validation
          { invalid: "field" },
        ]),
      ).toThrow(ZodError)
    })
  })

  describe("template validation", () => {
    it("should accept valid template", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.template("build", {
          script: ["npm run build"],
        }),
      ).not.toThrow()
    })

    it("should accept templates with validation errors (lenient validation)", () => {
      const builder = new ConfigBuilder()
      // Templates should accept invalid definitions because:
      // - They may contain !reference tags resolved later
      // - They are partial definitions extended by jobs
      expect(() =>
        builder.template("build", {
          script: 123 as never,
        }),
      ).not.toThrow()
    })
  })

  describe("job validation", () => {
    it("should accept valid job", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.job("test", {
          script: ["npm test"],
        }),
      ).not.toThrow()
    })

    it("should reject invalid job", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.job("test", {
          // @ts-expect-error - Testing runtime validation
          script: 123,
        }),
      ).toThrow(ZodError)
    })

    it("should validate nested properties", () => {
      const builder = new ConfigBuilder()
      expect(() =>
        builder.job("test", {
          script: ["npm test"],
          artifacts: { paths: "invalid" as never },
        }),
      ).toThrow(ZodError)
    })
  })
})
