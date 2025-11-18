import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - template", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  describe("template()", () => {
    it("should create a template job with leading dot", () => {
      config.template("base", {
        image: "node:22",
        before_script: ["npm install"],
      })

      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const template = result.jobs[".base"]!
      expect(template).toBeDefined()
      expect(template.image).toBe("node:22")
      expect(template.before_script).toEqual(["npm install"])
    })

    it("should preserve leading dot if already present", () => {
      config.template(".docker", {
        tags: ["docker"],
      })

      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const template = result.jobs[".docker"]!
      expect(template).toBeDefined()
      expect(template.tags).toEqual(["docker"])
    })

    it("should merge existing template when mergeExisting is true", () => {
      config.template("base", {
        image: "node:20",
      })

      config.template("base", {
        before_script: ["npm ci"],
      })

      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const template = result.jobs[".base"]!

      expect(template.image).toBe("node:20")
      expect(template.before_script).toEqual(["npm ci"])
    })

    it("should not merge existing template when mergeExisting is false", () => {
      config.template("base", {
        image: "node:20",
        before_script: ["npm install"],
      })

      config.template(
        "base",
        {
          tags: ["docker"],
        },
        { mergeExisting: false },
      )

      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const template = result.jobs[".base"]!

      // Should keep original since mergeExisting is false
      expect(template.image).toBe("node:20")
      expect(template.before_script).toEqual(["npm install"])
      expect(template.tags).toBeUndefined()
    })

    it("should be chainable", () => {
      const result = config
        .template("base", { image: "node:22" })
        .template("docker", { tags: ["docker"] })

      expect(result).toBe(config)
      const plain = config.getPlainObject()
      expect(plain.jobs?.[".base"]).toBeDefined()
      expect(plain.jobs?.[".docker"]).toBeDefined()
    })
  })

  describe("job() with dot prefix", () => {
    it("should delegate to template() when name starts with dot", () => {
      config.job(".template", {
        image: "alpine:latest",
      })

      const result = config.getPlainObject()
      if (!result.jobs) throw new Error("Expected jobs to be present")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const template = result.jobs[".template"]!
      expect(template).toBeDefined()
      expect(template.image).toBe("alpine:latest")
    })

    it("should handle hidden parameter correctly for template jobs", () => {
      // When name starts with dot, hidden parameter should be ignored
      config.job(
        ".base",
        {
          image: "node:22",
        },
        true,
      )

      const result = config.getPlainObject()

      expect(result.jobs?.[".base"]).toBeDefined()
      expect(result.jobs?.["..base"]).toBeUndefined()
    })

    it("should merge template definitions via job() method", () => {
      config.job(".template", {
        image: "node:20",
      })

      config.job(".template", {
        tags: ["docker"],
      })

      const result = config.getPlainObject()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const template = result.jobs![".template"]!

      expect(template.image).toBe("node:20")
      expect(template.tags).toEqual(["docker"])
    })
  })

  describe("template usage with extends", () => {
    it("should allow extending from templates created with template()", () => {
      config.template("base", {
        image: "node:22",
        before_script: ["npm install"],
      })

      config.extends(".base", "build", {
        script: ["npm run build"],
      })

      const result = config.getPlainObject()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const buildJob = result.jobs!.build!
      expect(buildJob.image).toBe("node:22")
      expect(buildJob.before_script).toEqual(["npm install"])
      expect(buildJob.script).toEqual(["npm run build"])
    })

    it("should work with both template() and job() for templates", () => {
      config.template("base", { image: "node:22" })
      config.job(".docker", { tags: ["docker"] })

      config.extends([".base", ".docker"], "build", {
        script: ["npm run build"],
      })

      const result = config.getPlainObject()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const buildJob = result.jobs!.build!
      expect(buildJob.image).toBe("node:22")
      expect(buildJob.tags).toEqual(["docker"])
      expect(buildJob.script).toEqual(["npm run build"])
    })
  })

  describe("getJob() with templates", () => {
    it("should retrieve template definitions with getJob()", () => {
      config.template("base", {
        image: "node:22",
      })

      const template = config.getJob(".base")

      expect(template).toBeDefined()
      expect(template?.image).toBe("node:22")
    })

    it("should retrieve both jobs and templates with getJob()", () => {
      config.template("base", { image: "node:22" })
      config.job("build", { script: ["npm run build"] })

      const template = config.getJob(".base")
      const job = config.getJob("build")

      expect(template).toBeDefined()
      expect(job).toBeDefined()
    })
  })

  describe("separation of jobs and templates", () => {
    it("should keep jobs and templates separate internally", () => {
      config.template("base", { image: "node:22" })
      config.job("build", { script: ["npm run build"] })

      // Both should appear in output
      const result = config.getPlainObject()
      expect(result.jobs?.[".base"]).toBeDefined()
      expect(result.jobs?.build).toBeDefined()
    })

    it("should allow same base name for template and job", () => {
      config.template("deploy", { image: "alpine" })
      config.job("deploy", { script: ["echo deploying"] })

      const result = config.getPlainObject()

      // Template should be .deploy, job should be deploy
      expect(result.jobs?.[".deploy"]).toBeDefined()
      expect(result.jobs?.deploy).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.jobs![".deploy"]!.image).toBe("alpine")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.jobs!.deploy!.script).toEqual(["echo deploying"])
    })
  })

  describe("extends() with template names", () => {
    it("should accept template names with or without leading dot", () => {
      config.template("base", { image: "node:22" })

      // Both should work
      config.extends(".base", "build1", { script: ["build1"] })
      config.extends("base", "build2", { script: ["build2"] })

      const result = config.getPlainObject()

      expect(result.jobs?.build1).toBeDefined()
      expect(result.jobs?.build2).toBeDefined()
    })
  })
})
