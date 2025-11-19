import { describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Job Options", () => {
  describe("resolveExtends option", () => {
    it("should resolve extends by default", () => {
      const config = new Config()
      config.template(".base", { script: ["base command"] })
      config.job("child", { extends: ".base", stage: "test" })

      const result = config.getPlainObject()
      expect(result.jobs?.child).toMatchObject({
        script: ["base command"],
        stage: "test",
      })
      expect(result.jobs?.child?.extends).toBeUndefined()
    })

    it("should skip extends resolution when resolveExtends is false", () => {
      const config = new Config()
      config.template(".base", { script: ["base command"] })
      config.job("child", { extends: ".base", stage: "test" }, { resolveExtends: false })

      const result = config.getPlainObject()
      expect(result.jobs?.child).toMatchObject({
        extends: ".base",
        stage: "test",
      })
      expect(result.jobs?.child?.script).toBeUndefined()
    })

    it("should respect global resolveExtends: false", () => {
      const config = new Config()
      config.globalOptions({ resolveExtends: false })
      config.template(".base", { script: ["base command"] })
      config.job("child", { extends: ".base", stage: "test" })

      const result = config.getPlainObject()
      expect(result.jobs?.child).toMatchObject({
        extends: ".base",
        stage: "test",
      })
      expect(result.jobs?.child?.script).toBeUndefined()
    })

    it("should allow job-level override of global resolveExtends", () => {
      const config = new Config()
      config.globalOptions({ resolveExtends: false })
      config.template(".base", { script: ["base command"] })
      config.job("disabled", { extends: ".base", stage: "test" })
      config.job("enabled", { extends: ".base", stage: "deploy" }, { resolveExtends: true })

      const result = config.getPlainObject()

      // disabled should keep extends
      expect(result.jobs?.disabled).toMatchObject({
        extends: ".base",
        stage: "test",
      })
      expect(result.jobs?.disabled?.script).toBeUndefined()

      // enabled should resolve extends
      expect(result.jobs?.enabled).toMatchObject({
        script: ["base command"],
        stage: "deploy",
      })
      expect(result.jobs?.enabled?.extends).toBeUndefined()
    })
  })

  describe("mergeExisting option", () => {
    it("should merge by default when job name already exists", () => {
      const config = new Config()
      config.job("test", { script: ["first"] })
      config.job("test", { stage: "deploy" })

      const result = config.getPlainObject()
      expect(result.jobs?.test).toMatchObject({
        script: ["first"],
        stage: "deploy",
      })
    })

    it("should replace when mergeExisting is false", () => {
      const config = new Config()
      config.job("test", { script: ["first"], stage: "test" })
      config.job("test", { stage: "deploy" }, { mergeExisting: false })

      const result = config.getPlainObject()
      expect(result.jobs?.test).toMatchObject({
        stage: "deploy",
      })
      expect(result.jobs?.test?.script).toBeUndefined()
    })

    it("should respect global mergeExisting: false", () => {
      const config = new Config()
      config.globalOptions({ mergeExisting: false })
      config.job("test", { script: ["first"], stage: "test" })
      config.job("test", { stage: "deploy" })

      const result = config.getPlainObject()
      expect(result.jobs?.test).toMatchObject({
        stage: "deploy",
      })
      expect(result.jobs?.test?.script).toBeUndefined()
    })

    it("should allow job-level override of global mergeExisting", () => {
      const config = new Config()
      config.globalOptions({ mergeExisting: false })
      config.job("test1", { script: ["first"], stage: "test" })
      config.job("test1", { stage: "deploy" })

      config.job("test2", { script: ["second"], stage: "test" })
      config.job("test2", { stage: "build" }, { mergeExisting: true })

      const result = config.getPlainObject()

      // test1 should be replaced (global setting)
      expect(result.jobs?.test1).toMatchObject({
        stage: "deploy",
      })
      expect(result.jobs?.test1?.script).toBeUndefined()

      // test2 should be merged (local override)
      expect(result.jobs?.test2).toMatchObject({
        script: ["second"],
        stage: "build",
      })
    })
  })

  describe("hidden option", () => {
    it("should create template when hidden is true", () => {
      const config = new Config()
      config.job("base", { script: ["command"] }, { hidden: true })

      const result = config.getPlainObject()
      expect(result.jobs?.[".base"]).toMatchObject({
        script: ["command"],
      })
      expect(result.jobs?.base).toBeUndefined()
    })

    it("should work with extends method", () => {
      const config = new Config()
      config.template(".base", { script: ["base"] })
      config.extends(".base", "hidden-child", { stage: "test" }, { hidden: true })

      const result = config.getPlainObject()
      expect(result.jobs?.[".hidden-child"]).toBeDefined()
      expect(result.jobs?.["hidden-child"]).toBeUndefined()
    })
  })

  describe("combined options", () => {
    it("should work with multiple options together", () => {
      const config = new Config()
      config.template(".base", { script: ["base command"] })
      config.job(
        "test",
        { extends: ".base", stage: "test" },
        { resolveExtends: false, hidden: false, mergeExisting: true },
      )

      const result = config.getPlainObject()
      expect(result.jobs?.test).toMatchObject({
        extends: ".base",
        stage: "test",
      })
      expect(result.jobs?.test?.script).toBeUndefined()
    })

    it("should handle global options with selective job overrides", () => {
      const config = new Config()
      config.globalOptions({ resolveExtends: false, mergeExisting: false })

      config.template(".base", { script: ["base"] })
      config.job("job1", { extends: ".base" })
      config.job("job2", { extends: ".base" }, { resolveExtends: true })

      config.job("job3", { stage: "test" })
      config.job("job3", { script: ["override"] })

      config.job("job4", { stage: "deploy" })
      config.job("job4", { script: ["merged"] }, { mergeExisting: true })

      const result = config.getPlainObject()

      // job1: global resolveExtends=false
      expect(result.jobs?.job1?.extends).toBe(".base")

      // job2: local override resolveExtends=true
      expect(result.jobs?.job2?.script).toEqual(["base"])
      expect(result.jobs?.job2?.extends).toBeUndefined()

      // job3: global mergeExisting=false, replaced
      expect(result.jobs?.job3).toEqual({ script: ["override"] })

      // job4: local override mergeExisting=true, merged
      expect(result.jobs?.job4).toMatchObject({
        stage: "deploy",
        script: ["merged"],
      })
    })
  })
})
