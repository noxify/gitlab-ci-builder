import { mkdtemp, readFile, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { describe, expect, it } from "vitest"

import { toYaml, writeYamlFile } from "../src/export"
import { ConfigBuilder } from "../src/refactor"

describe("Export Integration with ConfigBuilder", () => {
  it("toYaml() should accept ConfigBuilder instance", () => {
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

  it("toYaml() should accept plain GitLabCi object (legacy)", () => {
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

  it("writeYamlFile() should write ConfigBuilder to file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "gitlab-ci-test-"))
    const filePath = join(tempDir, ".gitlab-ci.yml")

    try {
      const config = new ConfigBuilder()

      config.stages("test").job("test", {
        script: ["echo test"],
      })

      await writeYamlFile(filePath, config)

      const content = await readFile(filePath, "utf8")

      expect(content).toContain("stages:")
      expect(content).toContain("- test")
      expect(content).toContain("test:")
      expect(content).toContain("script:")
      expect(content).toContain("- echo test")
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it("writeYamlFile() should write plain GitLabCi object (legacy)", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "gitlab-ci-test-"))
    const filePath = join(tempDir, ".gitlab-ci.yml")

    try {
      const plainConfig = {
        stages: ["build"],
        jobs: {
          build: {
            script: ["echo build"],
          },
        },
      }

      await writeYamlFile(filePath, plainConfig)

      const content = await readFile(filePath, "utf8")

      expect(content).toContain("stages:")
      expect(content).toContain("- build")
      expect(content).toContain("build:")
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it("ConfigBuilder should have direct toYaml method", () => {
    const config = new ConfigBuilder()

    config.job("test", {
      script: ["echo test"],
    })

    const yaml = config.toYaml()

    expect(yaml).toContain("test:")
    expect(yaml).toContain("script:")
    expect(yaml).toContain("- echo test")
  })

  it("ConfigBuilder should have direct writeYamlFile method", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "gitlab-ci-test-"))
    const filePath = join(tempDir, ".gitlab-ci.yml")

    try {
      const config = new ConfigBuilder()

      config.job("deploy", {
        script: ["echo deploy"],
      })

      await config.writeYamlFile(filePath)

      const content = await readFile(filePath, "utf8")

      expect(content).toContain("deploy:")
      expect(content).toContain("- echo deploy")
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
