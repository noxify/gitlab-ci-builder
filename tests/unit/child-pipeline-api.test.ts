// oxlint-disable vitest/no-conditional-expect
// oxlint-disable vitest/max-expects
import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  expectTypeOf,
} from "vitest"

import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - childPipeline API", () => {
  beforeEach(() => {
    vol.reset()
  })

  afterEach(() => {
    vol.reset()
  })

  describe("childPipeline()", () => {
    it("should create a child pipeline with callback", () => {
      const config = new ConfigBuilder()

      config.stages("build", "trigger")
      config.job("build", { stage: "build", script: ["npm run build"] })

      config.childPipeline(
        "trigger:deploy",
        (child) => {
          child.stages("deploy")
          child.job("deploy:prod", {
            stage: "deploy",
            script: ["./deploy.sh"],
          })
          return child
        },
        {
          strategy: "depend",
        }
      )

      const pipeline = config.getPlainObject()

      expect(pipeline.jobs?.["trigger:deploy"]).toBeDefined()
      expect(pipeline.jobs?.["trigger:deploy"]?.trigger).toStrictEqual({
        include: { local: "ci/trigger-deploy-pipeline.yml" },
        strategy: "depend",
      })
    })

    it("should use custom output path", () => {
      const config = new ConfigBuilder()

      config.childPipeline(
        "trigger:custom",
        (child) => {
          child.job("test", { script: ["test"] })
          return child
        },
        {
          outputPath: "custom/path.yml",
        }
      )

      const pipeline = config.getPlainObject()

      expect(pipeline.jobs?.["trigger:custom"]?.trigger).toStrictEqual({
        include: { local: "custom/path.yml" },
      })
    })

    it("should support forwarding variables", () => {
      const config = new ConfigBuilder()

      config.childPipeline(
        "trigger:forward",
        (child) => {
          child.job("test", { script: ["test"] })
          return child
        },
        {
          forward: {
            yaml_variables: true,
            pipeline_variables: false,
          },
        }
      )

      const pipeline = config.getPlainObject()
      const triggerJob = pipeline.jobs?.["trigger:forward"]
      const trigger = triggerJob?.trigger

      expect(trigger).toBeDefined()
      if (trigger && typeof trigger === "object" && "forward" in trigger) {
        expectTypeOf(trigger).toBeObject()
        expect(trigger.forward).toStrictEqual({
          yaml_variables: true,
          pipeline_variables: false,
        })
      }
    })

    it("should support additional job options", () => {
      const config = new ConfigBuilder()

      config.stages("build", "trigger")

      config.childPipeline(
        "trigger:conditional",
        (child) => {
          child.job("test", { script: ["test"] })
          return child
        },
        {
          jobOptions: {
            stage: "trigger",
            rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }],
            needs: ["build"],
            variables: { DEPLOY_ENV: "production" },
          },
        }
      )

      const pipeline = config.getPlainObject()
      const job = pipeline.jobs?.["trigger:conditional"]

      expect(job?.stage).toBe("trigger")
      expect(job?.rules).toStrictEqual([{ if: '$CI_COMMIT_BRANCH == "main"' }])
      expect(job?.needs).toStrictEqual(["build"])
      expect(job?.variables).toStrictEqual({ DEPLOY_ENV: "production" })
    })

    it("should track child pipeline in state", () => {
      const config = new ConfigBuilder()

      config.childPipeline("trigger:test", (child) => {
        child.job("test", { script: ["test"] })
        return child
      })

      const childConfig = config.getChildPipeline("trigger:test")

      expect(childConfig).toBeDefined()
      expect(childConfig?.jobName).toBe("trigger:test")
      expect(childConfig?.outputPath).toBe("ci/trigger-test-pipeline.yml")
      expect(childConfig?.builder).toBeInstanceOf(ConfigBuilder)
    })

    it("should inherit global options in child pipeline", () => {
      const config = new ConfigBuilder({
        mergeExtends: false,
        missingExtendsPolicy: "error",
      })

      config.childPipeline("trigger:test", (child) => {
        // Child should inherit parent's global options
        const childPipeline = child.getPlainObject({ skipValidation: true })
        // Verify child can be built (inherits global options)
        expect(childPipeline).toBeDefined()

        child.job("test", { script: ["test"] })
        return child
      })
    })
  })

  describe("writeYamlFiles()", () => {
    it("should write parent and child pipeline files", async () => {
      const config = new ConfigBuilder()

      config.stages("build", "trigger")
      config.job("build", { stage: "build", script: ["npm run build"] })

      config.childPipeline("trigger:deploy", (child) => {
        child.stages("deploy")
        child.job("deploy:prod", {
          stage: "deploy",
          script: ["./deploy.sh"],
        })
        return child
      })

      const files = await config.writeYamlFiles("/test")

      expect(files.parent).toBe("/test/.gitlab-ci.yml")
      expect(files.children).toHaveLength(1)
      expect(files.children[0]).toBe("/test/ci/trigger-deploy-pipeline.yml")

      // Check parent file was written
      const parentContent = vol.readFileSync(
        "/test/.gitlab-ci.yml",
        "utf-8"
      ) as string
      expect(parentContent).toContain("stages:")
      expect(parentContent).toContain("build:")
      expect(parentContent).toContain("trigger:deploy:")

      // Check child file was written
      const childContent = vol.readFileSync(
        "/test/ci/trigger-deploy-pipeline.yml",
        "utf-8"
      ) as string
      expect(childContent).toContain("stages:")
      expect(childContent).toContain("deploy:prod:")
    })

    it("should use custom parent filename", async () => {
      const config = new ConfigBuilder()
      config.job("test", { script: ["test"] })

      const files = await config.writeYamlFiles("/test", {
        parentFilename: "custom.gitlab-ci.yml",
      })

      expect(files.parent).toBe("/test/custom.gitlab-ci.yml")
      expect(vol.existsSync("/test/custom.gitlab-ci.yml")).toBeTruthy()
    })

    it("should write multiple child pipelines", async () => {
      const config = new ConfigBuilder()

      config.childPipeline("trigger:test", (child) => {
        child.job("test", { script: ["test"] })
        return child
      })

      config.childPipeline("trigger:deploy", (child) => {
        child.job("deploy", { script: ["deploy"] })
        return child
      })

      const files = await config.writeYamlFiles("/test")

      expect(files.children).toHaveLength(2)
      expect(files.children).toContain("/test/ci/trigger-test-pipeline.yml")
      expect(files.children).toContain("/test/ci/trigger-deploy-pipeline.yml")

      expect(vol.existsSync("/test/ci/trigger-test-pipeline.yml")).toBeTruthy()
      expect(
        vol.existsSync("/test/ci/trigger-deploy-pipeline.yml")
      ).toBeTruthy()
    })

    it("should create directories if they don't exist", async () => {
      const config = new ConfigBuilder()

      config.childPipeline(
        "trigger:nested",
        (child) => {
          child.job("test", { script: ["test"] })
          return child
        },
        {
          outputPath: "deeply/nested/path/pipeline.yml",
        }
      )

      await config.writeYamlFiles("/test")

      expect(
        vol.existsSync("/test/deeply/nested/path/pipeline.yml")
      ).toBeTruthy()
    })

    it("should skip validation when option is set", async () => {
      const config = new ConfigBuilder()

      // Create config without validation
      config.job("basic", { script: ["echo test"] })

      config.childPipeline("trigger:test", (child) => {
        child.job("test", { script: ["test"] })
        return child
      })

      // Should not throw with skipValidation
      await expect(
        config.writeYamlFiles("/test", { skipValidation: true })
      ).resolves.toBeDefined()
    })
  })

  describe("Visualization with childPipeline", () => {
    it("should visualize child pipeline in Mermaid diagram", () => {
      const config = new ConfigBuilder()

      config.stages("build", "trigger")
      config.job("build", { stage: "build", script: ["build"] })

      config.childPipeline("trigger:deploy", (child) => {
        child.stages("deploy")
        child.job("deploy:prod", {
          stage: "deploy",
          script: ["deploy"],
        })
        return child
      })

      const mermaid = config.generateMermaidDiagram({
        showChildPipelines: true,
      })

      expect(mermaid).toContain("graph LR")
      expect(mermaid).toContain("build")
      expect(mermaid).toContain("trigger:deploy")
      // Child pipeline is shown via tracked configs (no "Child Pipeline:" text needed)
      expect(mermaid).toContain("deploy:prod")
      expect(mermaid).toContain("triggers")
    })

    it("should visualize child pipeline in ASCII tree", () => {
      const config = new ConfigBuilder()

      config.job("build", { script: ["build"] })

      config.childPipeline("trigger:deploy", (child) => {
        child.job("deploy", { script: ["deploy"] })
        return child
      })

      const ascii = config.generateAsciiTree({ showChildPipelines: true })

      expect(ascii).toContain("build")
      expect(ascii).toContain("trigger:deploy")
      expect(ascii).toContain("🔀 Child Pipeline:")
      expect(ascii).toContain("deploy")
    })

    it("should visualize child pipeline in stage table", () => {
      const config = new ConfigBuilder()

      config.stages("build", "trigger")
      config.job("build", { stage: "build", script: ["build"] })

      config.childPipeline(
        "trigger:deploy",
        (child) => {
          child.stages("deploy")
          child.job("deploy:prod", {
            stage: "deploy",
            script: ["deploy"],
          })
          return child
        },
        {
          jobOptions: { stage: "trigger" },
        }
      )

      const table = config.generateStageTable({ showChildPipelines: true })

      expect(table).toContain("build")
      expect(table).toContain("trigger:deploy")
      expect(table).toContain("CHILD PIPELINE")
      expect(table).toContain("deploy:prod")
    })

    it("should not require basePath when using childPipeline", () => {
      const config = new ConfigBuilder()

      config.childPipeline("trigger:test", (child) => {
        child.job("test", { script: ["test"] })
        return child
      })

      // Should work without basePath (no filesystem access needed)
      expect(() => {
        config.generateMermaidDiagram({ showChildPipelines: true })
      }).not.toThrow()

      expect(() => {
        config.generateAsciiTree({ showChildPipelines: true })
      }).not.toThrow()

      expect(() => {
        config.generateStageTable({ showChildPipelines: true })
      }).not.toThrow()
    })
  })

  describe("Integration with existing features", () => {
    it("should work with templates in child pipeline", () => {
      const config = new ConfigBuilder()

      config.childPipeline("trigger:test", (child) => {
        child.template(".base", {
          image: "node:20",
          before_script: ["npm install"],
        })

        child.job("test", {
          extends: ".base",
          script: ["npm test"],
        })

        return child
      })

      const childConfig = config.getChildPipeline("trigger:test")
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const childPipeline = childConfig?.builder.getPlainObject()

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.jobs?.[".base"]).toBeDefined()
      // Template properties should be inherited into the job
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.jobs?.test?.image).toBe("node:20")
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.jobs?.test?.before_script).toContain("npm install")
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.jobs?.test?.script).toContain("npm test")
    })

    it("should work with variables in child pipeline", () => {
      const config = new ConfigBuilder()

      config.childPipeline("trigger:test", (child) => {
        child.variables({
          DEPLOY_ENV: "production",
          VERSION: "1.0.0",
        })

        child.job("deploy", {
          script: ["./deploy.sh $DEPLOY_ENV"],
        })

        return child
      })

      const childConfig = config.getChildPipeline("trigger:test")
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const childPipeline = childConfig?.builder.getPlainObject()

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.variables).toStrictEqual({
        DEPLOY_ENV: "production",
        VERSION: "1.0.0",
      })
    })

    it("should work with workflow in child pipeline", () => {
      const config = new ConfigBuilder()

      config.childPipeline("trigger:test", (child) => {
        child.workflow({
          rules: [
            {
              if: '$CI_PIPELINE_SOURCE == "merge_request_event"',
              when: "always",
            },
          ],
        })

        child.job("test", { script: ["test"] })

        return child
      })

      const childConfig = config.getChildPipeline("trigger:test")
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const childPipeline = childConfig?.builder.getPlainObject()

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.workflow?.rules).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(childPipeline?.workflow?.rules?.[0]?.if).toBe(
        '$CI_PIPELINE_SOURCE == "merge_request_event"'
      )
    })
  })
})
