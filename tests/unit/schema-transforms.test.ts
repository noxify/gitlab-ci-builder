import { describe, expect, it } from "vitest"

import { ExtendsSchema, IncludeSchema, JobDefinitionParseSchema } from "../../src/schema"

describe("Schema Transforms", () => {
  describe("ExtendsSchema", () => {
    it("should transform string to array", () => {
      const result = ExtendsSchema.parse("template")
      expect(result).toEqual(["template"])
    })

    it("should keep array as is", () => {
      const result = ExtendsSchema.parse(["template1", "template2"])
      expect(result).toEqual(["template1", "template2"])
    })
  })

  describe("IncludeSchema", () => {
    it("should transform local path string to object", () => {
      const result = IncludeSchema.parse("templates/build.yml")
      expect(result).toEqual({ local: "templates/build.yml" })
    })

    it("should transform URL string to remote object", () => {
      const result = IncludeSchema.parse("https://example.com/ci.yml")
      expect(result).toEqual({ remote: "https://example.com/ci.yml" })
    })

    it("should keep object as is", () => {
      const input = { local: "templates/test.yml" }
      const result = IncludeSchema.parse(input)
      expect(result).toEqual(input)
    })
  })

  describe("JobDefinitionParseSchema with extends transform", () => {
    it("should normalize extends string to array", () => {
      const result = JobDefinitionParseSchema.parse({
        script: ["npm test"],
        extends: ".template",
      })

      expect(result.extends).toEqual([".template"])
    })

    it("should keep extends array as is", () => {
      const result = JobDefinitionParseSchema.parse({
        script: ["npm test"],
        extends: [".template1", ".template2"],
      })

      expect(result.extends).toEqual([".template1", ".template2"])
    })

    it("should work without extends", () => {
      const result = JobDefinitionParseSchema.parse({
        script: ["npm test"],
      })

      expect(result.extends).toBeUndefined()
    })
  })
})
