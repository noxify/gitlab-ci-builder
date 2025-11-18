import fs from "fs/promises"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Config } from "../src/config"
import { toYaml, writeYamlFile } from "../src/export"

describe("export", () => {
  describe("toYaml()", () => {
    it("should convert a simple config to YAML", () => {
      const config = new Config()
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
      const config = new Config()
      config.job("test", {
        script: ["echo test"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("test:")
      expect(yaml).toContain("script:")
      expect(yaml).toContain("- echo test")
    })

    it("should handle templates (hidden jobs)", () => {
      const config = new Config()
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
      const config = new Config()
      config.job("zebra", { script: ["echo z"] })
      config.job("alpha", { script: ["echo a"] })

      const yaml = toYaml(config.getPlainObject())
      const alphaIndex = yaml.indexOf("alpha:")
      const zebraIndex = yaml.indexOf("zebra:")

      expect(alphaIndex).toBeLessThan(zebraIndex)
    })

    it("should handle workflow rules", () => {
      const config = new Config()
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
      const config = new Config()
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
      const config = new Config()
      config.include("local.yml")
      config.include({ remote: "https://example.com/template.yml" })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("include:")
      expect(yaml).toContain("local: local.yml")
      expect(yaml).toContain("remote: https://example.com/template.yml")
    })

    it("should handle complex job definitions", () => {
      const config = new Config()
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

    it("should not include circular references", () => {
      const config = new Config()
      config.job("test", {
        script: ["echo test"],
      })

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).not.toContain("&")
      expect(yaml).not.toContain("*")
    })

    it("should handle empty config", () => {
      const config = new Config()
      const yaml = toYaml(config.getPlainObject())

      // Empty config should produce empty object
      expect(yaml.trim()).toBe("{}")
    })

    it("should handle variables with different types", () => {
      const config = new Config()
      config.variable("STRING_VAR", "value")
      config.variable("NUMBER_VAR", 42)
      config.variable("BOOL_VAR", true)

      const yaml = toYaml(config.getPlainObject())

      expect(yaml).toContain("STRING_VAR: value")
      expect(yaml).toContain("NUMBER_VAR: 42")
      expect(yaml).toContain("BOOL_VAR: true")
    })
  })

  describe("writeYamlFile()", () => {
    const testFilePath = "/tmp/test-gitlab-ci.yml"

    // Mock fs.writeFile
    beforeEach(() => {
      vi.spyOn(fs, "writeFile").mockResolvedValue()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("should write YAML to file with default encoding", async () => {
      const config = new Config()
      config.stages("build")
      config.job("build", {
        script: ["npm run build"],
      })

      await writeYamlFile(testFilePath, config.getPlainObject())

      expect(fs.writeFile).toHaveBeenCalledWith(testFilePath, expect.stringContaining("build:"), {
        encoding: "utf8",
      })
    })

    it("should write YAML to file with custom encoding", async () => {
      const config = new Config()
      config.job("test", {
        script: ["echo test"],
      })

      await writeYamlFile(testFilePath, config.getPlainObject(), { encoding: "utf-8" })

      expect(fs.writeFile).toHaveBeenCalledWith(testFilePath, expect.any(String), {
        encoding: "utf-8",
      })
    })

    it("should write complete pipeline to file", async () => {
      const config = new Config()
      config.stages("build", "test", "deploy")
      config.variable("CI", "true")
      config.defaults({ image: "node:22" })
      config.job("build", {
        stage: "build",
        script: ["npm run build"],
      })

      await writeYamlFile(testFilePath, config.getPlainObject())

      expect(fs.writeFile).toHaveBeenCalledTimes(1)
      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string

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
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Write failed"))

      const config = new Config()
      config.job("test", { script: ["echo test"] })

      await expect(writeYamlFile(testFilePath, config.getPlainObject())).rejects.toThrow(
        "Write failed",
      )
    })
  })
})
