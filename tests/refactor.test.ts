import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../src/refactor"

describe("ConfigBuilder", () => {
  it("should create a basic pipeline", () => {
    const config = new ConfigBuilder()

    config
      .stages("build", "test", "deploy")
      .variable("NODE_VERSION", "20")
      .job("build", {
        stage: "build",
        script: ["npm install", "npm run build"],
      })
      .job("test", {
        stage: "test",
        script: ["npm test"],
      })

    const result = config.finalize()

    expect(result.pipeline.stages).toEqual(["build", "test", "deploy"])
    expect(result.pipeline.variables).toEqual({ NODE_VERSION: "20" })
    expect(result.pipeline.jobs).toHaveProperty("build")
    expect(result.pipeline.jobs).toHaveProperty("test")
    expect(result.errors).toHaveLength(0)
  })

  it("should handle extends properly", () => {
    const config = new ConfigBuilder()

    config
      .template(".base", {
        image: "node:20",
        before_script: ["npm install"],
      })
      .extends(".base", "build", {
        stage: "build",
        script: ["npm run build"],
      })

    const result = config.finalize()

    expect(result.pipeline.jobs?.build).toMatchObject({
      image: "node:20",
      before_script: ["npm install"],
      script: ["npm run build"],
      stage: "build",
    })
    expect(result.errors).toHaveLength(0)
  })

  it("should handle workflow and defaults", () => {
    const config = new ConfigBuilder()

    config
      .workflow({
        rules: [{ if: "$CI_COMMIT_BRANCH == 'main'" }],
      })
      .defaults({
        image: "alpine:latest",
        retry: { max: 2 },
      })
      .job("test", {
        script: ["echo hello"],
      })

    const result = config.finalize()

    expect(result.pipeline.workflow).toMatchObject({
      rules: [{ if: "$CI_COMMIT_BRANCH == 'main'" }],
    })
    expect(result.pipeline.default).toMatchObject({
      image: "alpine:latest",
      retry: { max: 2 },
    })
    expect(result.errors).toHaveLength(0)
  })

  it("should merge jobs when mergeExisting is enabled", () => {
    const config = new ConfigBuilder()

    config
      .job("build", {
        script: ["npm install"],
        tags: ["docker"],
      })
      .job(
        "build",
        {
          script: ["npm run build"],
          tags: ["kubernetes"],
        },
        { mergeExisting: true },
      )

    const result = config.finalize()

    const buildJob = result.pipeline.jobs?.build
    expect(buildJob).toBeDefined()

    // Scripts should concat, tags should union
    expect(buildJob?.script).toEqual(["npm install", "npm run build"])
    expect(buildJob?.tags).toContain("docker")
    expect(buildJob?.tags).toContain("kubernetes")
    expect(result.errors).toHaveLength(0)
  })

  it("should support macro system", () => {
    const config = new ConfigBuilder()

    config
      .macro("addDockerJob", (cfg, args: { name: string; image: string }) => {
        cfg.job(args.name, {
          image: args.image,
          script: ["docker build ."],
        })
      })
      .from("addDockerJob", { name: "docker-build", image: "docker:latest" })

    const result = config.finalize()

    expect(result.pipeline.jobs?.["docker-build"]).toMatchObject({
      image: "docker:latest",
      script: ["docker build ."],
    })
    expect(result.errors).toHaveLength(0)
  })

  it("should apply patchers before output", () => {
    const config = new ConfigBuilder()

    config
      .job("test", {
        script: ["echo test"],
      })
      .patch((pipeline) => {
        // Modify output before finalization
        if (pipeline.jobs?.test) {
          pipeline.jobs.test.script = ["echo patched"]
        }
      })

    const result = config.finalize()

    expect(result.pipeline.jobs?.test?.script).toEqual(["echo patched"])
    expect(result.errors).toHaveLength(0)
  })

  it("should detect missing extends", () => {
    const config = new ConfigBuilder({ missingExtendsPolicy: "error" })

    config.job("test", {
      extends: ".nonexistent",
      script: ["echo test"],
    })

    const result = config.finalize()

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]?.code).toBe("MISSING_EXTENDS_TARGET")
  })

  it("should support performance mode", () => {
    const config = new ConfigBuilder({ performanceMode: true })

    // Create circular extends that would be caught in normal mode
    config
      .template(".a", { extends: ".b" })
      .template(".b", { extends: ".c" })
      .template(".c", { extends: ".a" })
      .job("test", {
        extends: ".a",
        script: ["echo test"],
      })

    const result = config.finalize()

    // Performance mode skips cycle detection
    expect(result.metadata.skippedChecks).toContain("cycle-detection")
  })

  it("should handle include configurations", () => {
    const config = new ConfigBuilder()

    config.include([
      { local: "/templates/base.yml" },
      { remote: "https://example.com/ci.yml" },
      { template: "Security/SAST.gitlab-ci.yml" },
    ])

    const result = config.finalize()

    expect(result.pipeline.include).toHaveLength(3)
    expect(result.errors).toHaveLength(0)
  })

  it("should support getVariable and getJob methods", () => {
    const config = new ConfigBuilder()

    config.variables({ GLOBAL: "global-value" }).job("test", {
      script: ["echo test"],
      variables: { JOB_VAR: "job-value" },
    })

    expect(config.getVariable("test", "JOB_VAR")).toBe("job-value")
    expect(config.getVariable("test", "GLOBAL")).toBe("global-value")

    const job = config.getJob("test")
    expect(job).toBeDefined()
    expect(job?.script).toEqual(["echo test"])
  })
})
