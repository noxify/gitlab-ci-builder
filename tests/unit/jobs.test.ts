// oxlint-disable vitest/max-expects
import { beforeEach, describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - jobs", () => {
  let config: ConfigBuilder

  beforeEach(() => {
    config = new ConfigBuilder()
  })

  describe("job()", () => {
    it("should add a new job", () => {
      config.job("build", {
        stage: "build",
        script: ["npm run build"],
      })
      const result = config.getPlainObject()
      if (!result.jobs) {
        throw new Error("Expected jobs to be present")
      }
      const { jobs } = result

      expect(jobs.build).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(jobs.build!.stage).toBe("build")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(jobs.build!.script).toStrictEqual(["npm run build"])
    })

    it("should add hidden job with dot prefix", () => {
      config.job("template", { script: ["echo template"] }, { hidden: true })
      const result = config.getPlainObject()
      if (!result.jobs) {
        throw new Error("Expected jobs to be present")
      }
      const { jobs } = result

      expect(jobs[".template"]).toBeDefined()
      expect(jobs.template).toBeUndefined()
    })

    it("should not add dot prefix if name already starts with dot", () => {
      config.job(".template", { script: ["echo template"] }, { hidden: true })
      const result = config.getPlainObject()
      if (!result.jobs) {
        throw new Error("Expected jobs to be present")
      }
      const { jobs } = result

      expect(jobs[".template"]).toBeDefined()
      expect(jobs["..template"]).toBeUndefined()
    })

    it("should merge existing job by default", () => {
      config.job("test", { stage: "test", script: ["echo first"] })
      config.job("test", { tags: ["docker"] })
      const result = config.getPlainObject()
      if (!result.jobs) {
        throw new Error("Expected jobs to be present")
      }
      const { jobs } = result

      expect(jobs.test).toMatchObject({
        stage: "test",
        script: ["echo first"],
        tags: ["docker"],
      })
    })

    it("should not merge when mergeExisting is false", () => {
      config.job("test", { stage: "test", script: ["echo first"] })
      config.job("test", { tags: ["docker"] }, { mergeExisting: false })
      const result = config.getPlainObject()
      if (!result.jobs) {
        throw new Error("Expected jobs to be present")
      }
      const { jobs } = result

      // Should have replaced original job
      expect(jobs.test).toMatchObject({
        tags: ["docker"],
      })
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(jobs.test!.stage).toBeUndefined()
    })

    it("should return this for chaining", () => {
      const result = config.job("test", { script: ["echo test"] })
      expect(result).toBe(config)
    })
  })

  describe("getJob()", () => {
    it("should get existing job", () => {
      config.job("build", { stage: "build", script: ["npm run build"] })
      const job = config.getJob("build")

      expect(job).toBeDefined()
      expect(job?.stage).toBe("build")
    })

    it("should return undefined for non-existent job", () => {
      expect(config.getJob("non-existent")).toBeUndefined()
    })

    it("should get hidden job by name with dot", () => {
      config.job("template", { script: ["echo template"] }, { hidden: true })
      const job = config.getJob(".template")

      expect(job).toBeDefined()
      expect(job?.script).toStrictEqual(["echo template"])
    })
  })
})
