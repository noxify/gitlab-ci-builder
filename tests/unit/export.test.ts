import { vol } from "memfs"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"
import { toYaml, writeYamlFile } from "../../src/export"

describe("YAML Export", () => {
  describe("toYaml() - Basic Conversion", () => {
    it("should convert a simple config to YAML", () => {
      const config = new ConfigBuilder()
      config.stages("build", "test")
      config.variable("NODE_ENV", "production")
      config.job("build", {
        stage: "build",
        script: ["npm run build"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("stages:")
      expect(yaml).toContain("- build")
      expect(yaml).toContain("- test")
      expect(yaml).toContain("NODE_ENV: production")
      expect(yaml).toContain("build:")
      expect(yaml).toContain("script:")
      expect(yaml).toContain("- npm run build")
    })

    it("should handle jobs at root level", () => {
      const config = new ConfigBuilder()
      config.job("test", {
        script: ["echo test"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("test:")
      expect(yaml).toContain("script:")
      expect(yaml).toContain("- echo test")
    })

    it("should handle templates (hidden jobs)", () => {
      const config = new ConfigBuilder()
      config.template(".base", {
        image: "node:22",
      })
      config.job("build", {
        script: ["npm run build"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain(".base:")
      expect(yaml).toContain("image: node:22")
      expect(yaml).toContain("build:")
    })

    it("should sort keys alphabetically", () => {
      const config = new ConfigBuilder()
      config.job("zebra", { script: ["echo z"] })
      config.job("alpha", { script: ["echo a"] })

      const yaml = toYaml(config.getPlainObject())
      const alphaIndex = yaml.indexOf("alpha:")
      const zebraIndex = yaml.indexOf("zebra:")

      expect(alphaIndex).toBeLessThan(zebraIndex)
    })

    it("should handle empty config", () => {
      const config = new ConfigBuilder()
      const yaml = toYaml(config.getPlainObject())

      // Empty config should produce empty object
      expect(yaml.trim()).toBe("{}")
    })

    it("should handle variables with different types", () => {
      const config = new ConfigBuilder()
      config.variable("STRING_VAR", "value")
      config.variable("NUMBER_VAR", 42)
      config.variable("BOOL_VAR", true)

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("STRING_VAR: value")
      expect(yaml).toContain("NUMBER_VAR: 42")
      expect(yaml).toContain("BOOL_VAR: true")
    })

    it("should not include circular references", () => {
      const config = new ConfigBuilder()
      config.job("test", {
        script: ["echo test"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).not.toContain("&")
      expect(yaml).not.toContain("*")
    })
  })

  describe("toYaml() - Pipeline Features", () => {
    it("should handle workflow rules", () => {
      const config = new ConfigBuilder()
      config.workflow({
        rules: [
          {
            if: '$CI_PIPELINE_SOURCE == "merge_request_event"',
            when: "always",
          },
        ],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("workflow:")
      expect(yaml).toContain("rules:")
      expect(yaml).toContain('if: $CI_PIPELINE_SOURCE == "merge_request_event"')
    })

    it("should handle default configuration", () => {
      const config = new ConfigBuilder()
      config.defaults({
        image: "node:22",
        tags: ["docker"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("default:")
      expect(yaml).toContain("image: node:22")
      expect(yaml).toContain("tags:")
      expect(yaml).toContain("- docker")
    })

    it("should handle includes", () => {
      const config = new ConfigBuilder()
      config.include("local.yml")
      config.include({ remote: "https://example.com/template.yml" })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("include:")
      expect(yaml).toContain("local: local.yml")
      expect(yaml).toContain("remote: https://example.com/template.yml")
    })

    it("should handle complex job definitions", () => {
      const config = new ConfigBuilder()
      config.job("deploy", {
        stage: "deploy",
        script: ["kubectl apply -f k8s/"],
        environment: {
          name: "production",
          url: "https://example.com",
        },
        rules: [
          {
            if: '$CI_COMMIT_BRANCH == "main"',
            when: "always",
          },
        ],
        tags: ["kubernetes"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("deploy:")
      expect(yaml).toContain("stage: deploy")
      expect(yaml).toContain("environment:")
      expect(yaml).toContain("name: production")
      expect(yaml).toContain("url: https://example.com")
      expect(yaml).toContain("rules:")
      expect(yaml).toContain("tags:")
      expect(yaml).toContain("- kubernetes")
    })

    it("should export needs with optional property", () => {
      const config = new ConfigBuilder()
      config.job("generate_version", {
        script: ["echo version"],
      })
      config.job("unit_tests", {
        script: ["npm test"],
      })
      config.job("deploy", {
        script: ["echo deploying"],
        needs: [
          {
            job: "generate_version",
            optional: true,
          },
          {
            job: "unit_tests",
          },
        ],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("deploy:")
      expect(yaml).toContain("needs:")
      expect(yaml).toContain("- job: generate_version")
      expect(yaml).toContain("optional: true")
      expect(yaml).toContain("- job: unit_tests")
    })
  })

  describe("toYaml() - Special Features", () => {
    it("should handle !reference tags without quotes", () => {
      const config = new ConfigBuilder()
      config.template(".pnpm_install_template", {
        script: ["pnpm install"],
      })
      config.job("test", {
        script: ["!reference [.pnpm_install_template, script]", "pnpm run test"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("test:")
      expect(yaml).toContain("script:")
      expect(yaml).toContain("- !reference [.pnpm_install_template, script]")
      expect(yaml).not.toContain('"!reference')
      expect(yaml).toContain("- pnpm run test")
    })

    it("should handle !reference in scalar values like image", () => {
      const config = new ConfigBuilder()
      config.template(".database_template", {
        image: "postgres:15",
      })
      config.job("test", {
        image: "!reference [.database_template, image]",
        script: ["npm test"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("test:")
      expect(yaml).toContain("image: !reference [.database_template, image]")
      expect(yaml).not.toContain('"!reference')
      expect(yaml).toContain("script:")
      expect(yaml).toContain("- npm test")
    })
  })

  describe("toYaml() - Input Compatibility", () => {
    it("should accept ConfigBuilder instance", () => {
      const config = new ConfigBuilder()

      config
        .stages("build", "test")
        .variable("NODE_VERSION", "20")
        .job("build", {
          stage: "build",
          script: ["npm run build"],
        })

      const yaml = toYaml(config)

      expect(yaml).toContain("stages:")
      expect(yaml).toContain("- build")
      expect(yaml).toContain("- test")
      expect(yaml).toContain("build:")
      expect(yaml).toContain("stage: build")
    })

    it("should accept plain GitLabCi object (legacy)", () => {
      const plainConfig = {
        stages: ["build"],
        jobs: {
          build: {
            stage: "build",
            script: ["echo build"],
          },
        },
      }

      const yaml = toYaml(plainConfig)

      expect(yaml).toContain("stages:")
      expect(yaml).toContain("- build")
      expect(yaml).toContain("build:")
    })
  })

  describe("writeYamlFile() - File Operations", () => {
    const testFilePath = "/test-gitlab-ci.yml"

    beforeEach(() => {
      vol.reset()
    })

    afterEach(() => {
      vol.reset()
    })

    it("should write YAML to file with default encoding", async () => {
      const config = new ConfigBuilder()
      config.stages("build")
      config.job("build", {
        script: ["npm run build"],
      })

      await writeYamlFile(testFilePath, config.getPlainObject())

      const writtenContent = vol.readFileSync(testFilePath, "utf8") as string
      expect(writtenContent).toContain("build:")
      expect(writtenContent).toContain("script:")
      expect(writtenContent).toContain("- npm run build")
    })

    it("should write YAML to file with custom encoding", async () => {
      const config = new ConfigBuilder()
      config.job("test", {
        script: ["echo test"],
      })

      await writeYamlFile(testFilePath, config.getPlainObject(), { encoding: "utf-8" })

      const writtenContent = vol.readFileSync(testFilePath, "utf-8") as string
      expect(writtenContent).toContain("test:")
      expect(writtenContent).toContain("echo test")
    })

    it("should write complete pipeline to file", async () => {
      const config = new ConfigBuilder()
      config.stages("build", "test", "deploy")
      config.variable("CI", "true")
      config.defaults({ image: "node:22" })
      config.job("build", {
        stage: "build",
        script: ["npm run build"],
      })

      await writeYamlFile(testFilePath, config.getPlainObject())

      const writtenContent = vol.readFileSync(testFilePath, "utf8") as string
      expect(writtenContent).toContain("stages:")
      expect(writtenContent).toContain("- build")
      expect(writtenContent).toContain("- test")
      expect(writtenContent).toContain("- deploy")
      expect(writtenContent).toMatch(/CI: ['"]?true['"]?/)
      expect(writtenContent).toContain("default:")
      expect(writtenContent).toContain("image: node:22")
      expect(writtenContent).toContain("build:")
      expect(writtenContent).toContain("stage: build")
    })

    it("should handle write errors", async () => {
      vol.mkdirSync("/readonly", { mode: 0o444 })
      const readonlyPath = "/readonly/test.yml"

      const config = new ConfigBuilder()
      config.job("test", { script: ["echo test"] })

      await expect(writeYamlFile(readonlyPath, config.getPlainObject())).rejects.toThrow()
    })
  })

  describe("writeYamlFile() - Real File Operations", () => {
    beforeEach(() => {
      vol.reset()
      vol.mkdirSync("/test-dir", { recursive: true })
    })

    afterEach(() => {
      vol.reset()
    })

    it("should write ConfigBuilder to file", async () => {
      const filePath = "/test-dir/.gitlab-ci.yml"

      const config = new ConfigBuilder()

      config.stages("test").job("test", {
        script: ["echo test"],
      })

      await writeYamlFile(filePath, config)

      const content = vol.readFileSync(filePath, "utf8") as string

      expect(content).toContain("stages:")
      expect(content).toContain("- test")
      expect(content).toContain("test:")
      expect(content).toContain("script:")
      expect(content).toContain("- echo test")
    })

    it("should write plain GitLabCi object (legacy)", async () => {
      const filePath = "/test-dir/.gitlab-ci.yml"

      const plainConfig = {
        stages: ["build"],
        jobs: {
          build: {
            script: ["echo build"],
          },
        },
      }

      await writeYamlFile(filePath, plainConfig)

      const content = vol.readFileSync(filePath, "utf8") as string

      expect(content).toContain("stages:")
      expect(content).toContain("- build")
      expect(content).toContain("build:")
    })
  })

  describe("ConfigBuilder - Direct Methods", () => {
    beforeEach(() => {
      vol.reset()
      vol.mkdirSync("/test-dir", { recursive: true })
    })

    afterEach(() => {
      vol.reset()
    })

    it("should have direct toYaml method", () => {
      const config = new ConfigBuilder()

      config.job("test", {
        script: ["echo test"],
      })

      const yaml = config.toYaml()

      expect(yaml).toContain("test:")
      expect(yaml).toContain("script:")
      expect(yaml).toContain("- echo test")
    })

    it("should have direct writeYamlFile method", async () => {
      const filePath = "/test-dir/.gitlab-ci.yml"

      const config = new ConfigBuilder()

      config.job("deploy", {
        script: ["echo deploy"],
      })

      await config.writeYamlFile(filePath)

      const content = vol.readFileSync(filePath, "utf8") as string

      expect(content).toContain("deploy:")
      expect(content).toContain("- echo deploy")
    })
  })
})
