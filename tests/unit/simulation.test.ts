import { vol } from "memfs"
import { beforeEach, describe, expect, test } from "vitest"

import type { RuleContext } from "../../src/simulation"
import { ConfigBuilder } from "../../src"
import { PipelineSimulator } from "../../src/simulation"

describe("Pipeline Simulation", () => {
  beforeEach(() => {
    // Reset virtual filesystem and create test files
    vol.reset()
    vol.fromJSON({
      "/project/src/index.ts": "export {}",
      "/project/package.json": "{}",
      "/project/Dockerfile": "FROM node:20",
    })
  })

  test("should simulate jobs with rules", () => {
    const config = new ConfigBuilder()
      .stages("build", "test")
      .job("build-job", {
        stage: "build",
        script: "npm run build",
        rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: "always" }],
      })
      .job("test-job", {
        stage: "test",
        script: "npm test",
        rules: [{ if: '$CI_COMMIT_BRANCH == "develop"', when: "always" }],
      })

    const simulator = new PipelineSimulator()

    // Simulate on main branch
    const mainContext: RuleContext = {
      variables: {
        CI_COMMIT_BRANCH: "main",
      },
      branch: "main",
    }

    const mainResult = simulator.simulate(config, mainContext)

    expect(mainResult.totalJobs).toBe(2)
    expect(mainResult.jobsToRun).toBe(1)
    expect(mainResult.jobsSkipped).toBe(1)

    const buildJob = mainResult.jobs.find((j) => j.name === "build-job")
    expect(buildJob?.shouldRun).toBe(true)
    expect(buildJob?.when).toBe("always")

    const testJob = mainResult.jobs.find((j) => j.name === "test-job")
    expect(testJob?.shouldRun).toBe(false)
    expect(testJob?.when).toBe("never")

    // Simulate on develop branch
    const developContext: RuleContext = {
      variables: {
        CI_COMMIT_BRANCH: "develop",
      },
      branch: "develop",
    }

    const developResult = simulator.simulate(config, developContext)

    expect(developResult.jobsToRun).toBe(1)
    const buildJobDevelop = developResult.jobs.find((j) => j.name === "build-job")
    expect(buildJobDevelop?.shouldRun).toBe(false)

    const testJobDevelop = developResult.jobs.find((j) => j.name === "test-job")
    expect(testJobDevelop?.shouldRun).toBe(true)
  })

  test("should simulate jobs with regex rules", () => {
    const config = new ConfigBuilder().job("deploy-staging", {
      script: "deploy.sh",
      rules: [{ if: "$CI_COMMIT_BRANCH =~ /^feature-.+/", when: "manual" }],
    })

    const simulator = new PipelineSimulator()

    // Feature branch - should match
    const featureContext: RuleContext = {
      variables: {
        CI_COMMIT_BRANCH: "feature-new-feature",
      },
      branch: "feature-new-feature",
    }

    const featureResult = simulator.simulate(config, featureContext)
    const featureJob = featureResult.jobs[0]
    expect(featureJob?.shouldRun).toBe(true)
    expect(featureJob?.when).toBe("manual")

    // Main branch - should not match
    const mainContext: RuleContext = {
      variables: {
        CI_COMMIT_BRANCH: "main",
      },
      branch: "main",
    }

    const mainResult = simulator.simulate(config, mainContext)
    const mainJob = mainResult.jobs[0]
    expect(mainJob?.shouldRun).toBe(false)
  })

  test("should simulate jobs without rules (default behavior)", () => {
    const config = new ConfigBuilder().job("simple-job", {
      script: "echo hello",
    })

    const simulator = new PipelineSimulator()
    const context: RuleContext = { variables: {} }

    const result = simulator.simulate(config, context)

    expect(result.totalJobs).toBe(1)
    expect(result.jobsToRun).toBe(1)

    const job = result.jobs[0]
    expect(job?.shouldRun).toBe(true)
    expect(job?.when).toBe("on_success")
  })

  test("should handle when: never rule", () => {
    const config = new ConfigBuilder().job("disabled-job", {
      script: "echo disabled",
      rules: [{ if: '$DISABLED == "true"', when: "never" }, { when: "always" }],
    })

    const simulator = new PipelineSimulator()

    // Disabled
    const disabledContext: RuleContext = {
      variables: {
        DISABLED: "true",
      },
    }

    const disabledResult = simulator.simulate(config, disabledContext)
    const disabledJob = disabledResult.jobs[0]
    expect(disabledJob?.shouldRun).toBe(false)
    expect(disabledJob?.when).toBe("never")

    // Enabled
    const enabledContext: RuleContext = {
      variables: {
        DISABLED: "false",
      },
    }

    const enabledResult = simulator.simulate(config, enabledContext)
    const enabledJob = enabledResult.jobs[0]
    expect(enabledJob?.shouldRun).toBe(true)
    expect(enabledJob?.when).toBe("always")
  })

  test("should respect stage order", () => {
    const config = new ConfigBuilder()
      .stages("build", "test", "deploy")
      .job("deploy-job", { stage: "deploy", script: "deploy.sh" })
      .job("test-job", { stage: "test", script: "test.sh" })
      .job("build-job", { stage: "build", script: "build.sh" })

    const simulator = new PipelineSimulator()
    const context: RuleContext = { variables: {} }

    const result = simulator.simulate(config, context)

    expect(result.jobs[0]?.name).toBe("build-job")
    expect(result.jobs[1]?.name).toBe("test-job")
    expect(result.jobs[2]?.name).toBe("deploy-job")
  })

  test("should simulate complex rules with multiple conditions", () => {
    const config = new ConfigBuilder().job("complex-job", {
      script: "complex.sh",
      rules: [
        { if: "$JOB_DISABLED =~ /true/i", when: "never" },
        { if: "$CI_MERGE_REQUEST_LABELS =~ /disable-job/i", when: "never" },
        { when: "always" },
      ],
    })

    const simulator = new PipelineSimulator()

    // Not disabled
    const enabledContext: RuleContext = {
      variables: {
        JOB_DISABLED: "false",
      },
    }

    const enabledResult = simulator.simulate(config, enabledContext)
    expect(enabledResult.jobs[0]?.shouldRun).toBe(true)

    const disabledContext: RuleContext = {
      variables: {
        JOB_DISABLED: "true",
      },
    }

    const disabledResult = simulator.simulate(config, disabledContext)
    expect(disabledResult.jobs[0]?.shouldRun).toBe(false)
  })

  test("should merge job variables with context variables", () => {
    const config = new ConfigBuilder().job("test-job", {
      script: "test.sh",
      variables: {
        JOB_DISABLED: "true",
        OTHER_VAR: "job-value",
      },
      rules: [{ if: "$JOB_DISABLED =~ /true/i", when: "never" }, { when: "always" }],
    })

    const simulator = new PipelineSimulator()

    // Job variable should override context variable
    const context: RuleContext = {
      variables: {
        JOB_DISABLED: "false", // This should be overridden by job variable
        OTHER_VAR: "context-value",
      },
    }

    const result = simulator.simulate(config, context)

    // Job should be skipped because job variable JOB_DISABLED="true" overrides context
    expect(result.jobs[0]?.shouldRun).toBe(false)
    expect(result.jobs[0]?.when).toBe("never")
  })

  test("should evaluate exists rule when file exists", () => {
    const config = new ConfigBuilder().stages("build").job("build-with-source", {
      stage: "build",
      script: "build .",
      rules: [{ exists: ["src/index.ts"] }, { when: "never" }],
    })

    const simulator = new PipelineSimulator()

    const context: RuleContext = {
      variables: {},
      basePath: "/project",
    }

    const result = simulator.simulate(config, context)

    // Job should run because src/index.ts exists
    const job = result.jobs[0]
    expect(job?.shouldRun).toBe(true)
    expect(job?.name).toBe("build-with-source")
  })

  test("should skip job when exists rule file does not exist", () => {
    const config = new ConfigBuilder().stages("build").job("build-with-dockerfile", {
      stage: "build",
      script: "docker build .",
      rules: [{ exists: ["nonexistent-file.txt"] }, { when: "never" }],
    })

    const simulator = new PipelineSimulator()

    const context: RuleContext = {
      variables: {},
      basePath: "/project",
    }

    const result = simulator.simulate(config, context)

    // Job should not run because file doesn't exist and second rule is when: never
    const job = result.jobs[0]
    expect(job?.shouldRun).toBe(false)
    expect(job?.when).toBe("never")
  })

  test("should interpolate variables in exists paths", () => {
    const config = new ConfigBuilder().stages("build").job("build-app", {
      stage: "build",
      script: "build.sh",
      variables: {
        APP_DIR: "src",
        APP_FILE: "index.ts",
      },
      rules: [{ exists: ["$APP_DIR/$APP_FILE"] }, { when: "never" }],
    })

    const simulator = new PipelineSimulator()

    const context: RuleContext = {
      variables: {},
      basePath: "/project",
    }

    const result = simulator.simulate(config, context)

    // Job should run because src/index.ts exists
    const job = result.jobs[0]
    expect(job?.shouldRun).toBe(true)
  })

  test("should handle exists with multiple file patterns", () => {
    const config = new ConfigBuilder().stages("build").job("build-any", {
      stage: "build",
      script: "build.sh",
      rules: [{ exists: ["package.json", "nonexistent.txt"] }, { when: "never" }],
    })

    const simulator = new PipelineSimulator()

    const context: RuleContext = {
      variables: {},
      basePath: "/project",
    }

    const result = simulator.simulate(config, context)

    // Job should run because at least one file (package.json) exists
    const job = result.jobs[0]
    expect(job?.shouldRun).toBe(true)
  })

  test("should skip exists rule when no basePath provided", () => {
    const config = new ConfigBuilder().stages("build").job("build-with-dockerfile", {
      stage: "build",
      script: "docker build .",
      rules: [{ exists: ["package.json"] }, { when: "always" }],
    })

    const simulator = new PipelineSimulator()

    // No basePath provided - cannot evaluate filesystem
    const context: RuleContext = {
      variables: {},
    }

    const result = simulator.simulate(config, context)

    // Should fall through to second rule (when: always)
    const job = result.jobs[0]
    expect(job?.shouldRun).toBe(true)
    expect(job?.when).toBe("always")
  })

  test("should combine exists with if condition", () => {
    const config = new ConfigBuilder().stages("build").job("build-main", {
      stage: "build",
      script: "docker build .",
      rules: [{ exists: ["Dockerfile"], if: '$CI_COMMIT_BRANCH == "main"' }, { when: "never" }],
    })

    const simulator = new PipelineSimulator()

    // File exists but wrong branch
    const developContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "develop" },
      basePath: "/project",
    }

    const developResult = simulator.simulate(config, developContext)
    expect(developResult.jobs[0]?.shouldRun).toBe(false)

    // File exists and correct branch
    const mainContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "main" },
      basePath: "/project",
    }

    const mainResult = simulator.simulate(config, mainContext)
    // Should be true because Dockerfile exists and branch is main
    expect(mainResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle != (not equals) operator in rules", () => {
    const config = new ConfigBuilder().stages("deploy").job("deploy-prod", {
      stage: "deploy",
      script: "deploy.sh",
      rules: [{ if: '$ENVIRONMENT != "development"' }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when ENVIRONMENT is development
    const devContext: RuleContext = {
      variables: { ENVIRONMENT: "development" },
    }
    const devResult = simulator.simulate(config, devContext)
    expect(devResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when ENVIRONMENT is production
    const prodContext: RuleContext = {
      variables: { ENVIRONMENT: "production" },
    }
    const prodResult = simulator.simulate(config, prodContext)
    expect(prodResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle !~ (regex not match) operator in rules", () => {
    const config = new ConfigBuilder().stages("test").job("test-prod", {
      stage: "test",
      script: "test.sh",
      rules: [{ if: "$CI_COMMIT_BRANCH !~ /^feature-.+/" }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when branch matches feature- pattern
    const featureContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "feature-new-ui" },
    }
    const featureResult = simulator.simulate(config, featureContext)
    expect(featureResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when branch doesn't match
    const mainContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "main" },
    }
    const mainResult = simulator.simulate(config, mainContext)
    expect(mainResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle variable existence check in rules", () => {
    const config = new ConfigBuilder().stages("build").job("build-custom", {
      stage: "build",
      script: "build.sh",
      rules: [{ if: "$CUSTOM_BUILD" }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when variable doesn't exist
    const noVarContext: RuleContext = {
      variables: {},
    }
    const noVarResult = simulator.simulate(config, noVarContext)
    expect(noVarResult.jobs[0]?.shouldRun).toBe(false)

    // Should skip when variable is empty string
    const emptyContext: RuleContext = {
      variables: { CUSTOM_BUILD: "" },
    }
    const emptyResult = simulator.simulate(config, emptyContext)
    expect(emptyResult.jobs[0]?.shouldRun).toBe(false)

    // Should skip when variable is "false"
    const falseContext: RuleContext = {
      variables: { CUSTOM_BUILD: "false" },
    }
    const falseResult = simulator.simulate(config, falseContext)
    expect(falseResult.jobs[0]?.shouldRun).toBe(false)

    // Should skip when variable is "0"
    const zeroContext: RuleContext = {
      variables: { CUSTOM_BUILD: "0" },
    }
    const zeroResult = simulator.simulate(config, zeroContext)
    expect(zeroResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when variable has truthy value
    const truthyContext: RuleContext = {
      variables: { CUSTOM_BUILD: "true" },
    }
    const truthyResult = simulator.simulate(config, truthyContext)
    expect(truthyResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle $CI_COMMIT_BRANCH special variable", () => {
    const config = new ConfigBuilder().stages("build").job("build-branch", {
      stage: "build",
      script: "build.sh",
      rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when no branch
    const noBranchContext: RuleContext = {
      variables: {},
    }
    const noBranchResult = simulator.simulate(config, noBranchContext)
    expect(noBranchResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when branch is main
    const branchContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "main" },
      branch: "main",
    }
    const branchResult = simulator.simulate(config, branchContext)
    expect(branchResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle $CI_COMMIT_TAG special variable", () => {
    const config = new ConfigBuilder().stages("release").job("release-tag", {
      stage: "release",
      script: "release.sh",
      rules: [{ if: "$CI_COMMIT_TAG =~ /^v[0-9]+/" }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when no tag
    const noTagContext: RuleContext = {
      variables: {},
    }
    const noTagResult = simulator.simulate(config, noTagContext)
    expect(noTagResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when tag matches pattern
    const tagContext: RuleContext = {
      variables: { CI_COMMIT_TAG: "v1.0.0" },
      tag: "v1.0.0",
    }
    const tagResult = simulator.simulate(config, tagContext)
    expect(tagResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle $CI_MERGE_REQUEST_ID special variable", () => {
    const config = new ConfigBuilder().stages("test").job("test-mr", {
      stage: "test",
      script: "test.sh",
      rules: [{ if: "$CI_MERGE_REQUEST_ID" }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when no MR
    const noMrContext: RuleContext = {
      variables: {},
    }
    const noMrResult = simulator.simulate(config, noMrContext)
    expect(noMrResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when MR ID variable is set
    const mrContext: RuleContext = {
      variables: { CI_MERGE_REQUEST_ID: "123" },
      mergeRequestLabels: ["enhancement"],
    }
    const mrResult = simulator.simulate(config, mrContext)
    expect(mrResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle $CI_PIPELINE_SOURCE with merge_request_event", () => {
    const config = new ConfigBuilder().stages("test").job("test-mr-pipeline", {
      stage: "test",
      script: "test.sh",
      rules: [{ if: '$CI_PIPELINE_SOURCE == "merge_request_event"' }],
    })

    const simulator = new PipelineSimulator()

    // Should skip when no MR
    const noMrContext: RuleContext = {
      variables: {},
    }
    const noMrResult = simulator.simulate(config, noMrContext)
    expect(noMrResult.jobs[0]?.shouldRun).toBe(false)

    // Should run when MR context is present
    const mrContext: RuleContext = {
      variables: { CI_PIPELINE_SOURCE: "merge_request_event" },
      mergeRequestLabels: ["enhancement"],
    }
    const mrResult = simulator.simulate(config, mrContext)
    expect(mrResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle $CI_PIPELINE_SOURCE with other values", () => {
    const config = new ConfigBuilder().stages("deploy").job("deploy-push", {
      stage: "deploy",
      script: "deploy.sh",
      rules: [{ if: '$CI_PIPELINE_SOURCE == "push"' }],
    })

    const simulator = new PipelineSimulator()

    // Should skip for unsupported pipeline sources
    const context: RuleContext = {
      variables: {},
    }
    const result = simulator.simulate(config, context)
    expect(result.jobs[0]?.shouldRun).toBe(false)
  })

  test("should handle case-insensitive regex flags", () => {
    const config = new ConfigBuilder().stages("build").job("build-feature", {
      stage: "build",
      script: "build.sh",
      rules: [{ if: "$CI_COMMIT_BRANCH =~ /^FEATURE-.+/i" }],
    })

    const simulator = new PipelineSimulator()

    // Should match with case-insensitive flag
    const context: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "feature-new-ui" },
    }
    const result = simulator.simulate(config, context)
    expect(result.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle undefined/empty condition edge cases", () => {
    const config = new ConfigBuilder().stages("build").job("build-fallback", {
      stage: "build",
      script: "build.sh",
      rules: [
        { if: '$UNDEFINED_VAR == "value"' },
        { when: "always" }, // Fallback
      ],
    })

    const simulator = new PipelineSimulator()

    // Should fall through to second rule when first doesn't match
    const context: RuleContext = {
      variables: {},
    }
    const result = simulator.simulate(config, context)
    expect(result.jobs[0]?.shouldRun).toBe(true)
    expect(result.jobs[0]?.when).toBe("always")
  })

  test("should handle negation operator in rules", () => {
    const config = new ConfigBuilder().stages("test").job("test-prod", {
      stage: "test",
      script: "test.sh",
      rules: [{ if: '!($CI_COMMIT_BRANCH == "develop")' }],
    })

    const simulator = new PipelineSimulator()

    // Should skip on develop (negated)
    const developContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "develop" },
    }
    const developResult = simulator.simulate(config, developContext)
    expect(developResult.jobs[0]?.shouldRun).toBe(false)

    // Should run on other branches
    const mainContext: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "main" },
    }
    const mainResult = simulator.simulate(config, mainContext)
    expect(mainResult.jobs[0]?.shouldRun).toBe(true)
  })

  test("should handle when: manual in rules", () => {
    const config = new ConfigBuilder().stages("deploy").job("deploy-manual", {
      stage: "deploy",
      script: "deploy.sh",
      rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: "manual" }],
    })

    const simulator = new PipelineSimulator()

    const context: RuleContext = {
      variables: { CI_COMMIT_BRANCH: "main" },
    }
    const result = simulator.simulate(config, context)
    expect(result.jobs[0]?.shouldRun).toBe(true)
    expect(result.jobs[0]?.when).toBe("manual")
    expect(result.jobsToRun).toBe(1)
  })
})
