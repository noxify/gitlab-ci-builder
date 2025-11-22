import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../src"

describe("PipelineState - Additional Coverage", () => {
  describe("addStage", () => {
    it("should add a single stage", () => {
      const config = new ConfigBuilder()

      config.addStage("build")
      config.addStage("test")
      config.addStage("build") // duplicate should be ignored

      const result = config.getPlainObject()
      expect(result.stages).toEqual(["build", "test"])
    })
  })

  describe("globalOptions", () => {
    it("should set global options", () => {
      const config = new ConfigBuilder()

      config.globalOptions({
        mergeExisting: false,
        missingExtendsPolicy: "error",
      })

      config.job("test1", { script: ["echo 1"] })
      config.job("test1", { script: ["echo 2"] }, { mergeExisting: true })

      const result = config.getPlainObject()
      // mergeExisting should respect job-level option
      expect(result.jobs?.test1?.script).toEqual(["echo 1", "echo 2"])
    })
  })

  describe("getJob", () => {
    it("should retrieve job definition", () => {
      const config = new ConfigBuilder()

      config.job("test", {
        script: ["echo test"],
        stage: "test",
      })

      const job = config.getJob("test")
      expect(job).toBeDefined()
      expect(job?.script).toEqual(["echo test"])
      expect(job?.stage).toBe("test")
    })

    it("should return undefined for non-existent job", () => {
      const config = new ConfigBuilder()
      const job = config.getJob("non-existent")
      expect(job).toBeUndefined()
    })
  })

  describe("template with hidden option", () => {
    it("should create template when hidden=true even without dot prefix", () => {
      const config = new ConfigBuilder()

      config.job("base", { script: ["echo base"] }, { hidden: true })
      config.job("test", {
        extends: ".base",
        script: ["echo test"],
      })

      const result = config.getPlainObject()
      expect(result.jobs).toHaveProperty(".base")
      expect(result.jobs).toHaveProperty("test")
    })
  })

  describe("variables", () => {
    it("should set multiple variables", () => {
      const config = new ConfigBuilder()

      config.variables({
        VAR1: "value1",
        VAR2: 42,
        VAR3: true,
      })

      const result = config.getPlainObject()
      expect(result.variables).toEqual({
        VAR1: "value1",
        VAR2: 42,
        VAR3: true,
      })
    })

    it("should merge variables when called multiple times", () => {
      const config = new ConfigBuilder()

      config.variables({ VAR1: "value1" })
      config.variables({ VAR2: "value2" })

      const result = config.getPlainObject()
      expect(result.variables).toEqual({
        VAR1: "value1",
        VAR2: "value2",
      })
    })
  })

  describe("workflow with multiple calls", () => {
    it("should merge workflow rules", () => {
      const config = new ConfigBuilder()

      config.workflow({
        rules: [{ if: "$CI_COMMIT_BRANCH == 'main'" }],
      })
      config.workflow({
        rules: [{ if: "$CI_PIPELINE_SOURCE == 'merge_request_event'" }],
      })

      const result = config.getPlainObject()
      expect(result.workflow?.rules).toHaveLength(2)
    })
  })

  describe("defaults with multiple calls", () => {
    it("should merge default configuration", () => {
      const config = new ConfigBuilder()

      config.defaults({
        image: "node:20",
        tags: ["docker"],
      })
      config.defaults({
        retry: { max: 2 },
      })

      const result = config.getPlainObject()
      expect(result.default?.image).toBe("node:20")
      expect(result.default?.tags).toEqual(["docker"])
      expect(result.default?.retry).toEqual({ max: 2 })
    })
  })
})
