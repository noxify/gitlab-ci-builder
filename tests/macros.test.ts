import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - macros", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  describe("macro()", () => {
    it("should register a macro", () => {
      config.macro("test-macro", (cfg, args: { name: string }) => {
        cfg.job(args.name, { script: ["echo test"] })
      })

      // Macro is registered internally, test via from()
      config.from("test-macro", { name: "test-job" })
      const result = config.getPlainObject()

      expect(result.jobs?.["test-job"]).toBeDefined()
    })

    it("should throw error when registering duplicate macro", () => {
      config.macro("duplicate", () => {
        // Intentionally empty
      })

      expect(() => {
        config.macro("duplicate", () => {
          // Intentionally empty
        })
      }).toThrow("Macro duplicate already defined! You are not allowed to overwrite it.")
    })
  })

  describe("from()", () => {
    it("should apply a registered macro", () => {
      config.macro("create-jobs", (cfg, args: { jobs: string[] }) => {
        args.jobs.forEach((jobName) => {
          cfg.job(jobName, { script: [`echo ${jobName}`] })
        })
      })

      config.from("create-jobs", { jobs: ["job1", "job2", "job3"] })
      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      const jobs = result.jobs
      const j1 = jobs.job1
      if (!j1) throw new Error("Expected job1 to be present")
      expect(j1.script).toEqual(["echo job1"])
      expect(jobs.job2).toBeDefined()
      expect(jobs.job3).toBeDefined()
    })

    it("should throw error when macro not found", () => {
      expect(() => {
        config.from("non-existent", {})
      }).toThrow(
        "Macro non-existent not found, please register it with Config#macro! Consider also, that you need to register the macro before you execute from it.",
      )
    })

    it("should pass arguments correctly to macro", () => {
      config.macro("with-args", (cfg, args: { stage: string; tags: string[] }) => {
        cfg.job("test-job", {
          stage: args.stage,
          tags: args.tags,
          script: ["test"],
        })
      })

      config.from("with-args", { stage: "test", tags: ["docker", "linux"] })
      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      const jobs = result.jobs
      const tj = jobs["test-job"]
      if (!tj) throw new Error("Expected test-job to be present")

      expect(tj.stage).toBe("test")
      expect(tj.tags).toEqual(["docker", "linux"])
    })
  })
})
