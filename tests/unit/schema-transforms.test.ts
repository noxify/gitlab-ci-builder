// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { ExtendsSchema } from "../../src/schema/base"
import { IncludeSchema } from "../../src/schema/include"
import { JobDefinitionParseSchema } from "../../src/schema/job"

describe("Schema Transforms", () => {
  describe("extends schema", () => {
    it("should transform string to array", () => {
      const result = ExtendsSchema.parse("template")
      expect(result).toStrictEqual(["template"])
    })

    it("should keep array as is", () => {
      const result = ExtendsSchema.parse(["template1", "template2"])
      expect(result).toStrictEqual(["template1", "template2"])
    })
  })

  describe("include schema", () => {
    it("should transform local path string to object", () => {
      const result = IncludeSchema.parse("templates/build.yml")
      expect(result).toStrictEqual({ local: "templates/build.yml" })
    })

    it("should transform URL string to remote object", () => {
      const result = IncludeSchema.parse("https://example.com/ci.yml")
      expect(result).toStrictEqual({ remote: "https://example.com/ci.yml" })
    })

    it("should keep object as is", () => {
      const input = { local: "templates/test.yml" }
      const result = IncludeSchema.parse(input)
      expect(result).toStrictEqual(input)
    })
  })

  describe("job definition schema with extends transform", () => {
    it("should normalize extends string to array", () => {
      const result = JobDefinitionParseSchema.parse({
        script: ["npm test"],
        extends: ".template",
      })

      expect(result.extends).toStrictEqual([".template"])
    })

    it("should keep extends array as is", () => {
      const result = JobDefinitionParseSchema.parse({
        script: ["npm test"],
        extends: [".template1", ".template2"],
      })

      expect(result.extends).toStrictEqual([".template1", ".template2"])
    })

    it("should work without extends", () => {
      const result = JobDefinitionParseSchema.parse({
        script: ["npm test"],
      })

      expect(result.extends).toBeUndefined()
    })
  })
})
