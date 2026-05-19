// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("Merge Rules", () => {
  describe("union strategy (tags)", () => {
    it("should union tags from parent and child", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          tags: ["docker", "linux"],
        })
        .job("test", {
          extends: ".base",
          tags: ["fast", "docker"],
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.tags).toContain("docker")
      expect(job?.tags).toContain("linux")
      expect(job?.tags).toContain("fast")
      expect(job?.tags).toHaveLength(3) // docker should not be duplicated
    })
  })

  describe("union strategy (services)", () => {
    it("should merge services by name", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          services: ["postgres:14", { name: "redis", alias: "cache" }],
        })
        .job("test", {
          extends: ".base",
          services: [{ name: "redis", alias: "redis-cache" }, "mysql:8"],
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.services).toHaveLength(3)
      // redis should be overridden by child
      const redis = job?.services?.find((s) =>
        typeof s === "string"
          ? s === "redis"
          : typeof s === "object" && !Array.isArray(s)
            ? s.name === "redis"
            : false
      )
      expect(redis).toStrictEqual({ name: "redis", alias: "redis-cache" })
    })
  })

  describe("deep merge strategy (cache)", () => {
    it("should deep merge cache objects", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          cache: {
            key: "base-key",
            paths: ["node_modules/"],
          },
        })
        .job("test", {
          extends: ".base",
          cache: {
            policy: "pull",
            paths: ["dist/"],
          },
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.cache).toMatchObject({
        key: "base-key",
        policy: "pull",
        paths: ["dist/"],
      })
    })

    it("should deep merge artifacts objects", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          artifacts: {
            expire_in: "1 week",
            paths: ["dist/"],
          },
        })
        .job("test", {
          extends: ".base",
          artifacts: {
            reports: {
              junit: "report.xml",
            },
          },
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.artifacts).toMatchObject({
        expire_in: "1 week",
        paths: ["dist/"],
        reports: {
          junit: "report.xml",
        },
      })
    })
  })

  describe("concat strategy (before_script, script, after_script)", () => {
    it("should concatenate scripts from parent and child", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          before_script: ["echo setup"],
          script: ["echo parent"],
          after_script: ["echo cleanup"],
        })
        .job("test", {
          extends: ".base",
          before_script: ["echo more setup"],
          script: ["echo child"],
          after_script: ["echo more cleanup"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.before_script).toStrictEqual([
        "echo setup",
        "echo more setup",
      ])
      expect(job?.script).toStrictEqual(["echo parent", "echo child"])
      expect(job?.after_script).toStrictEqual([
        "echo cleanup",
        "echo more cleanup",
      ])
    })
  })

  describe("replace strategy (stage, image, etc)", () => {
    it("should replace simple values from child", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          stage: "build",
          image: "node:20",
        })
        .job("test", {
          extends: ".base",
          stage: "test",
          image: "node:22",
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.stage).toBe("test")
      expect(job?.image).toBe("node:22")
    })

    it("should keep parent value if child does not provide it", () => {
      const config = new ConfigBuilder()

      config
        .template(".base", {
          stage: "build",
          image: "node:20",
          timeout: "1h",
        })
        .job("test", {
          extends: ".base",
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.stage).toBe("build")
      expect(job?.image).toBe("node:20")
      expect(job?.timeout).toBe("1h")
    })
  })

  describe("multiple extends", () => {
    it("should merge from multiple templates in order", () => {
      const config = new ConfigBuilder()

      config
        .template(".base1", {
          tags: ["linux"],
          before_script: ["echo base1"],
        })
        .template(".base2", {
          tags: ["docker"],
          before_script: ["echo base2"],
        })
        .job("test", {
          extends: [".base1", ".base2"],
          before_script: ["echo child"],
          script: ["echo test"],
        })

      const result = config.getPlainObject()
      const job = result.jobs?.test

      expect(job?.tags).toContain("linux")
      expect(job?.tags).toContain("docker")
      expect(job?.before_script).toStrictEqual([
        "echo base1",
        "echo base2",
        "echo child",
      ])
    })
  })
})
