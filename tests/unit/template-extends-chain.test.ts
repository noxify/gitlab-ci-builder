// oxlint-disable eslint/no-template-curly-in-string
// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - template extends chain resolution", () => {
  it("should resolve extends chain when job extends from template that extends another template", () => {
    const config = new ConfigBuilder()

    // Base template with cache and variables
    config.template(".node:cache", {
      cache: [
        {
          key: "${CACHE_KEY}-${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}",
          paths: ["${APP_DIR}/node_modules", "${APP_DIR}/.pnpm-store"],
          policy: "pull",
        },
      ],
      variables: {
        APP_DIR: ".",
        CACHE_KEY: "default",
      },
    })

    // Template with tags
    config.template(".env_tags", {
      tags: ["docker", "test"],
    })

    // Template extending .node:cache
    config.template(".deploy_job", {
      extends: ".node:cache",
      image: "node:20",
      script: ["echo 'deploy'"],
    })

    // Job extending both .deploy_job and .env_tags
    config.extends([".deploy_job", ".env_tags"], "deploy_to_env", {
      stage: "deploy",
      variables: {
        DEPLOYMENT_ID: "$ENV_DEPLOYMENT_ID",
      },
    })

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)

    const job = pipeline.jobs?.deploy_to_env
    expect(job).toBeDefined()

    // Should have cache from .node:cache (through .deploy_job)
    expect(job?.cache).toBeDefined()
    expect(job?.cache).toStrictEqual([
      {
        key: "${CACHE_KEY}-${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}",
        paths: ["${APP_DIR}/node_modules", "${APP_DIR}/.pnpm-store"],
        policy: "pull",
      },
    ])

    // Should have base variables from .node:cache AND job-specific variables
    expect(job?.variables).toStrictEqual({
      APP_DIR: ".",
      CACHE_KEY: "default",
      DEPLOYMENT_ID: "$ENV_DEPLOYMENT_ID",
    })

    // Should have tags from .env_tags
    expect(job?.tags).toStrictEqual(["docker", "test"])

    // Should have image and script from .deploy_job
    expect(job?.image).toBe("node:20")
    expect(job?.script).toStrictEqual(["echo 'deploy'"])

    // Should have stage from job definition
    expect(job?.stage).toBe("deploy")

    // Templates are resolved, extends removed
    expect(job?.extends).toBeUndefined()
  })

  it("should handle complex extends chain with multiple levels", () => {
    const config = new ConfigBuilder()

    config.template(".base", {
      variables: {
        BASE_VAR: "base",
      },
      tags: ["base"],
    })

    config.template(".middleware", {
      extends: ".base",
      variables: {
        MIDDLEWARE_VAR: "middleware",
      },
      tags: ["middleware"],
    })

    config.template(".top", {
      extends: ".middleware",
      variables: {
        TOP_VAR: "top",
      },
      script: ["echo 'top'"],
    })

    config.job("final_job", {
      extends: ".top",
      stage: "test",
      variables: {
        JOB_VAR: "job",
      },
    })

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })

    expect(result.errors).toHaveLength(0)

    const job = pipeline.jobs?.final_job

    // Should have all variables merged
    expect(job?.variables).toStrictEqual({
      BASE_VAR: "base",
      MIDDLEWARE_VAR: "middleware",
      TOP_VAR: "top",
      JOB_VAR: "job",
    })

    // Tags should be merged (union)
    expect(job?.tags).toContain("base")
    expect(job?.tags).toContain("middleware")

    // Should have script from .top
    expect(job?.script).toStrictEqual(["echo 'top'"])

    expect(job?.stage).toBe("test")
  })

  it("should respect variable overrides in extends chain", () => {
    const config = new ConfigBuilder()

    config.template(".base", {
      variables: {
        VAR1: "base",
        VAR2: "base",
      },
    })

    config.template(".middleware", {
      extends: ".base",
      variables: {
        VAR1: "middleware", // Override VAR1
      },
    })

    config.job("job", {
      extends: ".middleware",
      variables: {
        VAR1: "job", // Override VAR1 again
        VAR3: "job", // Add new variable
      },
    })

    const pipeline = config.getPlainObject({ skipValidation: true })
    const job = pipeline.jobs?.job

    // VAR1 should be overridden by job
    // VAR2 should keep base value
    // VAR3 should be added by job
    expect(job?.variables).toStrictEqual({
      VAR1: "job",
      VAR2: "base",
      VAR3: "job",
    })
  })

  it("should handle scripts concatenation through extends chain", () => {
    const config = new ConfigBuilder()

    config.template(".base", {
      script: ["echo 'base'"],
    })

    config.template(".middleware", {
      extends: ".base",
      script: ["echo 'middleware'"],
    })

    config.job("job", {
      extends: ".middleware",
      script: ["echo 'job'"],
    })

    const pipeline = config.getPlainObject({ skipValidation: true })
    const job = pipeline.jobs?.job

    // Scripts should be concatenated in order: base -> middleware -> job
    expect(job?.script).toStrictEqual([
      "echo 'base'",
      "echo 'middleware'",
      "echo 'job'",
    ])
  })
})
