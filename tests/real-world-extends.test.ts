import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../src"

describe("ConfigBuilder - Real-world extends scenario", () => {
  it("should handle complex extends chain with cache and variables inheritance", () => {
    const config = new ConfigBuilder()

    // Base template with cache and variables
    config.template(".base:cache", {
      cache: [
        {
          key: "${CACHE_KEY}-${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}",
          paths: ["${PROJECT_DIR}/node_modules", "${PROJECT_DIR}/.cache"],
          policy: "pull",
        },
      ],
      variables: {
        PROJECT_DIR: ".",
        CACHE_KEY: "default",
      },
    })

    // Tags template
    config.template(".deployment:tags", {
      tags: ["kubernetes", "production"],
    })

    // Database template extending base cache
    config.template(".database:setup", {
      extends: ".base:cache",
      image: "node:20-alpine",
      script: [
        "export DATABASE_URL=$DATABASE_URL",
        "!reference [.install:deps, script]",
        "npm run db:migrate",
        "npm run db:seed",
      ],
    })

    // Deploy template extending base cache
    config.template(".deploy:service", {
      extends: ".base:cache",
      image: "!reference [.database:setup, image]",
      script: [
        "!reference [.install:deps, script]",
        "export DEPLOY_ENV=$DEPLOY_ENV",
        "npm run build",
        "npm run deploy -- $SERVICE_NAME",
      ],
    })

    // Final job extending both deploy service and deployment tags
    config.extends([".deploy:service", ".deployment:tags"], "deploy_review_app", {
      stage: "review",
      variables: {
        DEPLOY_ENV: "$ENVIRONMENT_REVIEW",
        SERVICE_NAME: "${APP_PREFIX}-${CI_COMMIT_REF_SLUG}-review",
        DATABASE_URL: "$DATABASE_URL_REVIEW",
        APP_PREFIX: "myapp",
      },
      rules: [
        {
          if: "$CI_PIPELINE_SOURCE =~ /merge_request/",
          when: "on_success",
        },
        {
          if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH",
          when: "never",
        },
        {
          when: "manual",
        },
      ],
      needs: [
        {
          job: "build_docker_image",
          optional: true,
        },
        {
          job: "run_unit_tests",
          optional: true,
        },
        {
          job: "run_integration_tests",
          optional: true,
        },
      ],
    })

    const result = config.finalize()

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)

    const job = result.pipeline.jobs?.deploy_review_app
    expect(job).toBeDefined()

    // Verify all expected properties are present

    // Tags from .deployment:tags
    expect(job?.tags).toEqual(["kubernetes", "production"])

    // Cache from .base:cache (through .deploy:service)
    expect(job?.cache).toEqual([
      {
        key: "${CACHE_KEY}-${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}",
        paths: ["${PROJECT_DIR}/node_modules", "${PROJECT_DIR}/.cache"],
        policy: "pull",
      },
    ])

    // Variables: merged from .base:cache and job definition
    expect(job?.variables).toEqual({
      PROJECT_DIR: ".",
      CACHE_KEY: "default",
      DEPLOY_ENV: "$ENVIRONMENT_REVIEW",
      SERVICE_NAME: "${APP_PREFIX}-${CI_COMMIT_REF_SLUG}-review",
      DATABASE_URL: "$DATABASE_URL_REVIEW",
      APP_PREFIX: "myapp",
    })

    // Image from .deploy:service (which references .database:setup)
    expect(job?.image).toBe("!reference [.database:setup, image]")

    // Script from .deploy:service
    expect(job?.script).toEqual([
      "!reference [.install:deps, script]",
      "export DEPLOY_ENV=$DEPLOY_ENV",
      "npm run build",
      "npm run deploy -- $SERVICE_NAME",
    ])

    // Stage from job definition
    expect(job?.stage).toBe("review")

    // Rules from job definition
    expect(job?.rules).toHaveLength(3)
    expect(job?.rules?.[0]).toEqual({
      if: "$CI_PIPELINE_SOURCE =~ /merge_request/",
      when: "on_success",
    })

    // Needs from job definition
    expect(job?.needs).toHaveLength(3)
    expect(Array.isArray(job?.needs) ? job.needs[0] : undefined).toEqual({
      job: "build_docker_image",
      optional: true,
    })

    // No extends in final output
    expect(job?.extends).toBeUndefined()
  })

  it("should generate correct YAML output with inherited properties", () => {
    const config = new ConfigBuilder()

    config.template(".base:cache", {
      cache: [
        {
          key: "${CACHE_KEY}-${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}",
          paths: ["${PROJECT_DIR}/node_modules", "${PROJECT_DIR}/.cache"],
          policy: "pull",
        },
      ],
      variables: {
        PROJECT_DIR: ".",
        CACHE_KEY: "default",
      },
    })

    config.template(".deployment:tags", {
      tags: ["kubernetes", "production"],
    })

    config.template(".deploy:service", {
      extends: ".base:cache",
      image: "!reference [.database:setup, image]",
      script: [
        "!reference [.install:deps, script]",
        "export DEPLOY_ENV=$DEPLOY_ENV",
        "npm run build",
        "npm run deploy -- $SERVICE_NAME",
      ],
    })

    config.extends([".deploy:service", ".deployment:tags"], "deploy_review_app", {
      stage: "review",
      variables: {
        DEPLOY_ENV: "$ENVIRONMENT_REVIEW",
        SERVICE_NAME: "${APP_PREFIX}-${CI_COMMIT_REF_SLUG}-review",
        DATABASE_URL: "$DATABASE_URL_REVIEW",
        APP_PREFIX: "myapp",
      },
      rules: [
        {
          if: "$CI_PIPELINE_SOURCE =~ /merge_request/",
          when: "on_success",
        },
        {
          if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH",
          when: "never",
        },
        {
          when: "manual",
        },
      ],
      needs: [
        {
          job: "build_docker_image",
          optional: true,
        },
        {
          job: "run_unit_tests",
          optional: true,
        },
        {
          job: "run_integration_tests",
          optional: true,
        },
      ],
    })

    const yaml = config.toYaml()

    // Check that output contains all expected fields
    expect(yaml).toContain("deploy_review_app:")
    expect(yaml).toContain("tags:")
    expect(yaml).toContain("- kubernetes")
    expect(yaml).toContain("- production")
    expect(yaml).toContain("cache:")
    expect(yaml).toContain("key: ${CACHE_KEY}-${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}")
    expect(yaml).toContain("variables:")
    expect(yaml).toContain("PROJECT_DIR: .")
    expect(yaml).toContain("CACHE_KEY: default")
    expect(yaml).toContain("DEPLOY_ENV: $ENVIRONMENT_REVIEW")
    expect(yaml).toContain("image: !reference [.database:setup, image]")
    expect(yaml).toContain("stage: review")
  })
})
