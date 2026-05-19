// oxlint-disable eslint/no-template-curly-in-string
// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"
import { PipelineState } from "../../src/model/pipeline"

describe("PipelineState - Additional Coverage", () => {
  describe("addStage", () => {
    it("should add a single stage", () => {
      const config = new ConfigBuilder()

      config.addStage("build")
      config.addStage("test")
      config.addStage("build") // duplicate should be ignored

      const result = config.getPlainObject()
      expect(result.stages).toStrictEqual(["build", "test"])
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
      expect(result.jobs?.test1?.script).toStrictEqual(["echo 1", "echo 2"])
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
      expect(job?.script).toStrictEqual(["echo test"])
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
      expect(result.variables).toStrictEqual({
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
      expect(result.variables).toStrictEqual({
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
      expect(result.default?.tags).toStrictEqual(["docker"])
      expect(result.default?.retry).toStrictEqual({ max: 2 })
    })
  })

  describe("deprecated global options", () => {
    it("should set and get deprecated image", () => {
      const state = new PipelineState()
      state.setDeprecatedImage("node:20")

      expect(state.deprecatedImage).toBe("node:20")
    })

    it("should set deprecated services", () => {
      const state = new PipelineState()
      state.setDeprecatedServices(["postgres:14", "redis:7"])

      expect(state.deprecatedServices).toStrictEqual(["postgres:14", "redis:7"])
    })

    it("should set deprecated before_script", () => {
      const state = new PipelineState()
      state.setDeprecatedBeforeScript(["npm ci"])

      expect(state.deprecatedBeforeScript).toStrictEqual(["npm ci"])
    })

    it("should set deprecated after_script", () => {
      const state = new PipelineState()
      state.setDeprecatedAfterScript(["cleanup.sh"])

      expect(state.deprecatedAfterScript).toStrictEqual(["cleanup.sh"])
    })

    it("should set deprecated cache", () => {
      const state = new PipelineState()
      state.setDeprecatedCache({
        key: "${CI_COMMIT_REF_SLUG}",
        paths: ["node_modules/"],
      })

      expect(state.deprecatedCache).toStrictEqual({
        key: "${CI_COMMIT_REF_SLUG}",
        paths: ["node_modules/"],
      })
    })
  })

  describe("toPlainObject()", () => {
    it("should create plain object with all fields", () => {
      const state = new PipelineState()
      state.setStages(["build", "test"])
      state.setVariables({ NODE_ENV: "production" })
      state.addInclude({ local: "template.yml" })
      state.setSpec({ inputs: { env: { type: "string" } } })

      const plain = state.toPlainObject()

      expect(plain.stages).toStrictEqual(["build", "test"])
      expect(plain.variables).toStrictEqual({ NODE_ENV: "production" })
      expect(plain.include).toStrictEqual([{ local: "template.yml" }])
      expect(plain.spec).toStrictEqual({ inputs: { env: { type: "string" } } })
    })

    it("should include deprecated globals when set", () => {
      const state = new PipelineState()
      state.setDeprecatedImage("alpine:latest")
      state.setDeprecatedServices(["postgres:14"])

      const plain = state.toPlainObject()

      expect(plain.image).toBe("alpine:latest")
      expect(plain.services).toStrictEqual(["postgres:14"])
    })

    it("should include workflow and default when set", () => {
      const state = new PipelineState()
      state.setWorkflow({ rules: [{ if: "$CI_COMMIT_BRANCH" }] })
      state.setDefaults({ image: "node:20" })

      const plain = state.toPlainObject()

      expect(plain.workflow).toStrictEqual({
        rules: [{ if: "$CI_COMMIT_BRANCH" }],
      })
      expect(plain.default).toStrictEqual({ image: "node:20" })
    })
  })

  describe("clone()", () => {
    it("should create deep copy of state", () => {
      const state = new PipelineState()
      state.setStages(["build", "test"])
      state.setVariables({ NODE_ENV: "production" })
      state.addInclude({ local: "template.yml" })

      const cloned = state.clone()

      expect(cloned.stages).toStrictEqual(state.stages)
      expect(cloned.variables).toStrictEqual(state.variables)
      expect(cloned.include).toStrictEqual(state.include)

      // Verify it's a deep copy
      cloned.addStages(["deploy"])
      expect(state.stages).not.toContain("deploy")
      expect(cloned.stages).toContain("deploy")
    })

    it("should clone deprecated options", () => {
      const state = new PipelineState()
      state.setDeprecatedImage("alpine:latest")
      state.setDeprecatedServices(["postgres:14"])
      state.setDeprecatedCache({ key: "cache", paths: ["node_modules/"] })

      const cloned = state.clone()

      expect(cloned.deprecatedImage).toBe("alpine:latest")
      expect(cloned.deprecatedServices).toStrictEqual(["postgres:14"])
      expect(cloned.deprecatedCache).toStrictEqual({
        key: "cache",
        paths: ["node_modules/"],
      })
    })
  })
})
