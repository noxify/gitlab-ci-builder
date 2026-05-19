// oxlint-disable vitest/max-expects
import { vol } from "memfs"
import { beforeEach, describe, expect, test } from "vitest"

import { ConfigBuilder } from "../../src"
import { PipelineSimulator } from "../../src/simulation/pipeline-simulator"
import type { RuleContext } from "../../src/simulation/rule-evaluator"

describe("Pipeline Simulator - Edge Cases", () => {
  beforeEach(() => {
    // Reset virtual filesystem
    vol.reset()
  })

  describe("Job Detection", () => {
    test("should include jobs with trigger (child pipeline)", () => {
      const config = new ConfigBuilder().stages("deploy").job("trigger-child", {
        stage: "deploy",
        trigger: {
          include: "child-pipeline.yml",
        },
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
      expect(result.jobs[0]?.name).toBe("trigger-child")
      expect(result.jobs[0]?.shouldRun).toBeFalsy() // No rules means default behavior
    })

    test("should include jobs with release", () => {
      const config = new ConfigBuilder()
        .stages("release")
        .job("create-release", {
          stage: "release",
          release: {
            tag_name: "v1.0.0",
            description: "Release notes",
          },
        })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
      expect(result.jobs[0]?.name).toBe("create-release")
    })

    test("should include jobs with pages", () => {
      const config = new ConfigBuilder().stages("deploy").job("pages", {
        stage: "deploy",
        pages: {
          path_prefix: "/docs",
        },
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
      expect(result.jobs[0]?.name).toBe("pages")
    })

    test("should include jobs with needs containing pipeline trigger", () => {
      const config = new ConfigBuilder().stages("test").job("downstream-test", {
        stage: "test",
        script: "test.sh",
        needs: [
          {
            pipeline: "parent-pipeline",
          },
        ],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
      expect(result.jobs[0]?.name).toBe("downstream-test")
    })

    test("should exclude template jobs without script or content", () => {
      const config = new ConfigBuilder().stages("test").job(".template", {
        stage: "test",
        tags: ["docker"],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(0)
    })

    test("should include jobs with custom stage and configuration", () => {
      const config = new ConfigBuilder().stages("custom").job("custom-job", {
        stage: "custom",
        variables: {
          CUSTOM_VAR: "value",
        },
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
      expect(result.jobs[0]?.name).toBe("custom-job")
    })

    test("should include jobs with rules even without script", () => {
      const config = new ConfigBuilder().stages("deploy").job("deploy-job", {
        stage: "deploy",
        rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }],
        image: "alpine:latest",
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = {
        variables: { CI_COMMIT_BRANCH: "main" },
      }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
      expect(result.jobs[0]?.shouldRun).toBeFalsy() // Rules without script don't auto-run
    })

    test("should include jobs with image configuration", () => {
      const config = new ConfigBuilder().stages("build").job("test-alpine", {
        stage: "build", // Use non-default stage
        image: "alpine:latest",
        tags: ["docker"],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
    })

    test("should include jobs with before_script", () => {
      const config = new ConfigBuilder()
        .stages("build")
        .job("build-with-setup", {
          stage: "build",
          before_script: ["echo setup"],
        })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
    })

    test("should include jobs with after_script", () => {
      const config = new ConfigBuilder()
        .stages("deploy")
        .job("test-with-cleanup", {
          stage: "deploy", // Use non-default stage
          after_script: ["echo cleanup"],
        })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
    })

    test("should include jobs with only clause", () => {
      const config = new ConfigBuilder().stages("deploy").job("deploy-prod", {
        stage: "deploy",
        only: ["main"],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
    })

    test("should include jobs with except clause", () => {
      const config = new ConfigBuilder().stages("build").job("test-not-main", {
        stage: "build", // Use non-default stage
        except: ["main"],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(1)
    })
  })

  describe("Stage Processing", () => {
    test("should process jobs in stage order", () => {
      const config = new ConfigBuilder()
        .stages("build", "test", "deploy")
        .job("deploy-job", {
          stage: "deploy",
          script: "deploy.sh",
        })
        .job("build-job", {
          stage: "build",
          script: "build.sh",
        })
        .job("test-job", {
          stage: "test",
          script: "test.sh",
        })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      // Jobs should be ordered by stage
      expect(result.jobs[0]?.name).toBe("build-job")
      expect(result.jobs[0]?.stage).toBe("build")
      expect(result.jobs[1]?.name).toBe("test-job")
      expect(result.jobs[1]?.stage).toBe("test")
      expect(result.jobs[2]?.name).toBe("deploy-job")
      expect(result.jobs[2]?.stage).toBe("deploy")
    })

    test("should group jobs by stage in summary", () => {
      const config = new ConfigBuilder()
        .stages("build", "test")
        .job("build-1", {
          stage: "build",
          script: "build.sh",
        })
        .job("build-2", {
          stage: "build",
          script: "build2.sh",
        })
        .job("test-1", {
          stage: "test",
          script: "test.sh",
        })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.stages).toStrictEqual(["build", "test"])
      expect(result.totalJobs).toBe(3)
    })
  })

  describe("Job Variables", () => {
    test("should merge job variables with context variables", () => {
      const config = new ConfigBuilder().stages("test").job("test-vars", {
        stage: "test",
        script: "test.sh",
        variables: {
          JOB_VAR: "job-value",
        },
        rules: [{ if: "$JOB_VAR" }],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = {
        variables: { CONTEXT_VAR: "context-value" },
      }
      const result = simulator.simulate(config, context)

      // Job should run because JOB_VAR is set
      expect(result.jobs[0]?.shouldRun).toBeTruthy()
    })

    test("should prioritize job variables over context variables", () => {
      const config = new ConfigBuilder().stages("test").job("test-priority", {
        stage: "test",
        script: "test.sh",
        variables: {
          SHARED_VAR: "job-override",
        },
        rules: [{ if: '$SHARED_VAR == "job-override"' }],
      })

      const simulator = new PipelineSimulator()
      const context: RuleContext = {
        variables: { SHARED_VAR: "context-value" },
      }
      const result = simulator.simulate(config, context)

      // Job should run because job variable overrides context
      expect(result.jobs[0]?.shouldRun).toBeTruthy()
    })
  })

  describe("Empty Pipeline", () => {
    test("should handle pipeline with no jobs", () => {
      const config = new ConfigBuilder().stages("test")

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(0)
      expect(result.jobsToRun).toBe(0)
      expect(result.jobsSkipped).toBe(0)
      expect(result.jobs).toStrictEqual([])
    })

    test("should handle pipeline with only template jobs", () => {
      const config = new ConfigBuilder()
        .stages("test")
        .job(".template-1", {
          stage: "test",
        })
        .job(".template-2", {
          stage: "test",
          tags: ["docker"],
        })

      const simulator = new PipelineSimulator()
      const context: RuleContext = { variables: {} }
      const result = simulator.simulate(config, context)

      // Templates without content should not be included
      expect(result.totalJobs).toBe(0)
    })
  })
})
