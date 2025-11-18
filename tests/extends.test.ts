import { beforeEach, describe, expect, it } from "vitest"

import { Config } from "../src/config"

describe("Config - extends", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
  })

  it("should extend from a single job", () => {
    config.job(".template", {
      image: "node:22",
      before_script: ["npm install"],
    })

    config.extends(".template", "build", {
      script: ["npm run build"],
    })

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs

    expect(jobs.build).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buildJob = jobs.build!
    // After resolution, extends is removed and properties are merged
    expect(buildJob.image).toBe("node:22")
    expect(buildJob.before_script).toEqual(["npm install"])
    expect(buildJob.script).toEqual(["npm run build"])
  })

  it("should extend from multiple jobs", () => {
    config.job(".base", {
      image: "node:22",
    })

    config.job(".docker", {
      tags: ["docker"],
    })

    config.extends([".base", ".docker"], "build", {
      script: ["npm run build"],
    })

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs

    expect(jobs.build).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buildJob = jobs.build!
    // Properties from both templates should be merged
    expect(buildJob.image).toBe("node:22")
    expect(buildJob.tags).toEqual(["docker"])
    expect(buildJob.script).toEqual(["npm run build"])
  })

  it("should create hidden job when hidden parameter is true", () => {
    config.job(".template", {
      image: "node:22",
    })

    config.extends(".template", "base-job", { script: ["test"] }, true)

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs

    expect(jobs[".base-job"]).toBeDefined()
    expect(jobs["base-job"]).toBeUndefined()
  })

  it("should merge job definition with extends", () => {
    config.job(".template", {
      image: "node:22",
    })

    config.extends(".template", "test", {
      stage: "test",
      script: ["npm test"],
    })

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const testJob = jobs.test!

    // Properties should be merged from template and job definition
    expect(testJob.image).toBe("node:22")
    expect(testJob.stage).toBe("test")
    expect(testJob.script).toEqual(["npm test"])
  })

  it("should resolve extends in getPlainObject", () => {
    config.job(".template", {
      image: "node:22",
      tags: ["docker"],
    })

    config.extends(".template", "build", {
      stage: "build",
      script: ["npm run build"],
    })

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buildJob = jobs.build!

    // After resolution, the job should have inherited properties
    expect(buildJob.image).toBe("node:22")
    expect(buildJob.tags).toEqual(["docker"])
    expect(buildJob.stage).toBe("build")
    expect(buildJob.script).toEqual(["npm run build"])
  })

  it("should handle chain of extends", () => {
    config.job(".base", {
      image: "node:22",
    })

    config.extends(".base", ".with-deps", {
      before_script: ["npm install"],
    })

    config.extends(".with-deps", "build", {
      script: ["npm run build"],
    })

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buildJob = jobs.build!

    // Should inherit from both .base and .with-deps
    expect(buildJob.image).toBe("node:22")
    expect(buildJob.before_script).toEqual(["npm install"])
    expect(buildJob.script).toEqual(["npm run build"])
  })

  it("should allow extending with undefined job definition", () => {
    config.job(".template", {
      script: ["echo template"],
    })

    config.extends(".template", "simple")

    const result = config.getPlainObject()
    if (!result.jobs) throw new Error("Expected jobs to be present")
    const jobs = result.jobs

    expect(jobs.simple).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const simpleJob = jobs.simple!
    // Should inherit script from template
    expect(simpleJob.script).toEqual(["echo template"])
  })
})
