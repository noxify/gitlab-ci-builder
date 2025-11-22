import { beforeEach, describe, expect, it } from "vitest"

import type { PipelineOutput } from "../../src"
import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - JSON Serialization", () => {
  let config: ConfigBuilder

  beforeEach(() => {
    config = new ConfigBuilder()
  })

  describe("getPlainObject()", () => {
    it("should return flattened configuration with jobs at root", () => {
      config.stages("build", "test")
      config.variable("NODE_ENV", "production")
      config.job("build", { stage: "build", script: ["npm run build"] })
      config.job("test", { stage: "test", script: ["npm test"] })

      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build", "test"])
      expect(result.variables?.NODE_ENV).toBe("production")
      expect(result.jobs?.build).toBeDefined()
      expect(result.jobs?.test).toBeDefined()
    })

    it("should not include empty stages array", () => {
      const result = config.getPlainObject()
      expect(result.stages).toBeUndefined()
    })

    it("should not include empty variables object", () => {
      const result = config.getPlainObject()
      expect(result.variables).toBeUndefined()
    })

    it("should not include empty workflow", () => {
      const result = config.getPlainObject()
      expect(result.workflow).toBeUndefined()
    })
  })

  describe("toJSON()", () => {
    it("should return same as getPlainObject", () => {
      config.stages("build")
      config.job("test", { script: ["echo test"] })

      const plain = config.getPlainObject()
      const json = config.toJSON()

      expect(json).toEqual(plain)
    })

    it("should be called by JSON.stringify", () => {
      config.variable("TEST", "value")
      config.job("build", { script: ["npm run build"] })

      const serialized = JSON.parse(JSON.stringify(config)) as PipelineOutput

      expect(serialized.variables?.TEST).toBe("value")
      expect(serialized.jobs?.build).toBeDefined()
    })
  })

  describe("RegExp serialization", () => {
    it("should serialize RegExp in job rules", () => {
      config.job("test", {
        script: ["echo test"],
        rules: [
          {
            if: /^feature\/.*/.toString(),
            when: "always",
          },
        ],
      })

      const serialized = JSON.parse(JSON.stringify(config)) as PipelineOutput
      const testRules = serialized.jobs?.test?.rules
      if (testRules && Array.isArray(testRules)) {
        const firstRule = testRules[0]
        if (firstRule && typeof firstRule !== "string") {
          expect(firstRule.if).toBe("/^feature\\/.*/")
        }
      }
    })
  })
})

describe("ConfigBuilder - YAML Serialization", () => {
  it("should serialize a basic pipeline to YAML", () => {
    const config = new ConfigBuilder()

    config
      .stages("build", "test")
      .variable("NODE_VERSION", "20")
      .job("build", {
        stage: "build",
        script: ["npm install", "npm run build"],
      })

    const yaml = config.toYaml()

    expect(yaml).toContain("variables:")
    expect(yaml).toContain("NODE_VERSION: '20'")
    expect(yaml).toContain("stages:")
    expect(yaml).toContain("- build")
    expect(yaml).toContain("- test")
    expect(yaml).toContain("build:")
    expect(yaml).toContain("stage: build")
    expect(yaml).toContain("script:")
    expect(yaml).toContain("- npm install")
    expect(yaml).toContain("- npm run build")
  })

  it("should order keys correctly (workflow, include, default, variables, stages, jobs)", () => {
    const config = new ConfigBuilder()

    config
      .workflow({ rules: [{ if: "$CI_COMMIT_BRANCH" }] })
      .include([{ local: "/templates/base.yml" }])
      .defaults({ image: "alpine:latest" })
      .variables({ TEST: "value" })
      .stages("test")
      .job("test", { script: ["echo test"] })

    const yaml = config.toYaml()
    const lines = yaml.split("\n")

    const workflowIdx = lines.findIndex((l) => l.startsWith("workflow:"))
    const includeIdx = lines.findIndex((l) => l.startsWith("include:"))
    const defaultIdx = lines.findIndex((l) => l.startsWith("default:"))
    const variablesIdx = lines.findIndex((l) => l.startsWith("variables:"))
    const stagesIdx = lines.findIndex((l) => l.startsWith("stages:"))
    const testJobIdx = lines.findIndex((l) => l.startsWith("test:"))

    // Verify order
    expect(workflowIdx).toBeLessThan(includeIdx)
    expect(includeIdx).toBeLessThan(defaultIdx)
    expect(defaultIdx).toBeLessThan(variablesIdx)
    expect(variablesIdx).toBeLessThan(stagesIdx)
    expect(stagesIdx).toBeLessThan(testJobIdx)
  })

  it("should sort jobs alphabetically with templates first", () => {
    const config = new ConfigBuilder()

    config
      .template(".ztemplate", { script: ["echo z"] })
      .template(".atemplate", { script: ["echo a"] })
      .job("zjob", { script: ["echo z"] })
      .job("ajob", { script: ["echo a"] })

    const yaml = config.toYaml()
    const lines = yaml.split("\n")

    const atemplateIdx = lines.findIndex((l) => l.startsWith(".atemplate:"))
    const ztemplateIdx = lines.findIndex((l) => l.startsWith(".ztemplate:"))
    const ajobIdx = lines.findIndex((l) => l.startsWith("ajob:"))
    const zjobIdx = lines.findIndex((l) => l.startsWith("zjob:"))

    // Templates come before regular jobs
    expect(atemplateIdx).toBeLessThan(ajobIdx)
    expect(ztemplateIdx).toBeLessThan(zjobIdx)

    // Templates are sorted alphabetically
    expect(atemplateIdx).toBeLessThan(ztemplateIdx)

    // Regular jobs are sorted alphabetically
    expect(ajobIdx).toBeLessThan(zjobIdx)
  })

  it("should handle !reference tags", () => {
    const config = new ConfigBuilder()

    config
      .template(".base", {
        script: ["npm install"],
      })
      .job("build", {
        script: ["!reference [.base, script]", "npm run build"],
      })

    const yaml = config.toYaml()

    // !reference should be in inline format
    expect(yaml).toContain("!reference [.base, script]")
  })

  it("should add blank lines between top-level sections", () => {
    const config = new ConfigBuilder()

    config
      .variables({ VAR: "value" })
      .stages("test")
      .job("test", { script: ["echo test"] })

    const yaml = config.toYaml()

    // There should be blank lines between sections
    expect(yaml).toMatch(/variables:\s+VAR: .+\n\nstages:/s)
    expect(yaml).toMatch(/stages:\s+- test\n\ntest:/s)
  })

  it("should handle extends with arrays", () => {
    const config = new ConfigBuilder()

    config
      .template(".base1", { image: "node:20" })
      .template(".base2", { before_script: ["npm install"] })
      .job("build", {
        extends: [".base1", ".base2"],
        script: ["npm run build"],
      })

    const yaml = config.toYaml()

    // After resolution, extends should be removed (only remote extends are kept)
    expect(yaml).toContain("build:")
    expect(yaml).toContain("image: node:20")
    expect(yaml).toContain("- npm install")
    expect(yaml).toContain("- npm run build")
  })

  it("should preserve remote extends", () => {
    const config = new ConfigBuilder()

    config.job(
      "test",
      {
        extends: "remote-job",
        script: ["echo test"],
      },
      { remote: true },
    )

    const yaml = config.toYaml()

    // Remote extends should be preserved
    expect(yaml).toContain("extends: remote-job")
  })

  it("should handle workflow with auto_cancel", () => {
    const config = new ConfigBuilder()

    config.workflow({
      name: "Pipeline",
      rules: [{ if: "$CI_COMMIT_BRANCH" }],
      auto_cancel: {
        on_new_commit: "interruptible",
      },
    })

    const yaml = config.toYaml()

    expect(yaml).toContain("workflow:")
    expect(yaml).toContain("name: Pipeline")
    expect(yaml).toContain("rules:")
    expect(yaml).toContain("auto_cancel:")
    expect(yaml).toContain("on_new_commit: interruptible")
  })

  it("should handle complex artifacts configuration", () => {
    const config = new ConfigBuilder()

    config.job("build", {
      script: ["npm run build"],
      artifacts: {
        paths: ["dist/"],
        expire_in: "1 week",
        when: "always",
      },
    })

    const yaml = config.toYaml()

    expect(yaml).toContain("artifacts:")
    expect(yaml).toContain("paths:")
    expect(yaml).toContain("- dist/")
    expect(yaml).toContain("expire_in: 1 week")
    expect(yaml).toContain("when: always")
  })

  it("should handle cache configuration", () => {
    const config = new ConfigBuilder()

    config.defaults({
      cache: {
        key: "$CI_COMMIT_REF_SLUG",
        paths: ["node_modules/"],
      },
    })

    const yaml = config.toYaml()

    expect(yaml).toContain("default:")
    expect(yaml).toContain("cache:")
    expect(yaml).toContain("key: $CI_COMMIT_REF_SLUG")
    expect(yaml).toContain("paths:")
    expect(yaml).toContain("- node_modules/")
  })
})
