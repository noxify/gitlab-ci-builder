import { describe, expect, test } from "vitest"

import type { RuleContext } from "../../src/simulation"
import { ConfigBuilder } from "../../src"
import { PipelineSimulator } from "../../src/simulation"

describe("Pipeline Simulation", () => {
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
})
