import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("Fluent Job Builder API", () => {
  it("should support addJob with chaining", () => {
    const config = new ConfigBuilder()

    config.addJob("test").stage("test").image("node:20").script(["npm test"]).done()

    const plain = config.getPlainObject()
    expect(plain.jobs?.test).toBeDefined()
    expect(plain.jobs?.test?.stage).toBe("test")
    expect(plain.jobs?.test?.image).toBe("node:20")
    expect(plain.jobs?.test?.script).toEqual(["npm test"])
  })

  it("should support addTemplate with chaining", () => {
    const config = new ConfigBuilder()

    config.addTemplate(".base").image("alpine:latest").beforeScript(["apk add curl"]).done()

    const plain = config.getPlainObject()
    expect(plain.jobs?.[".base"]).toBeDefined()
    expect(plain.jobs?.[".base"]?.image).toBe("alpine:latest")
    expect(plain.jobs?.[".base"]?.before_script).toEqual(["apk add curl"])
  })

  it("should support auto-return when calling addJob/addTemplate", () => {
    const config = new ConfigBuilder()

    config
      .addTemplate(".base")
      .image("alpine:latest")
      .addJob("test")
      .stage("test")
      .extends(".base")
      .script(["npm test"])
      .addJob("build")
      .stage("build")
      .script(["npm run build"])
      .done()

    const plain = config.getPlainObject()
    expect(plain.jobs?.[".base"]).toBeDefined()
    expect(plain.jobs?.test).toBeDefined()
    expect(plain.jobs?.build).toBeDefined()
  })

  it("should support set() for bulk property updates", () => {
    const config = new ConfigBuilder()

    config
      .addJob("test")
      .set({
        stage: "test",
        image: "node:20",
        script: ["npm test"],
        cache: { paths: ["node_modules/"] },
      })
      .done()

    const plain = config.getPlainObject()
    expect(plain.jobs?.test?.stage).toBe("test")
    expect(plain.jobs?.test?.image).toBe("node:20")
    expect(plain.jobs?.test?.script).toEqual(["npm test"])
    expect(plain.jobs?.test?.cache).toEqual({ paths: ["node_modules/"] })
  })

  it("should support jobOptions for remote jobs", () => {
    const config = new ConfigBuilder()

    config.addJob("remote-job").script(["echo test"]).remote().done()

    const graph = config.getExtendsGraph()
    const node = graph.get("remote-job")
    expect(node?.isRemote).toBe(true)
  })

  it("should support all common job properties", () => {
    const config = new ConfigBuilder()

    config
      .addJob("complex")
      .stage("test")
      .image({ name: "node:20", entrypoint: ["/bin/sh"] })
      .services([{ name: "postgres:13" }])
      .script(["npm test"])
      .beforeScript(["npm ci"])
      .afterScript(["npm run cleanup"])
      .cache({ paths: ["node_modules/"], key: "test" })
      .artifacts({
        paths: ["coverage/"],
        reports: {
          coverage_report: { coverage_format: "cobertura", path: "coverage/cobertura.xml" },
        },
      })
      .setVariables({ NODE_ENV: "test" })
      .environment({ name: "test", url: "https://test.example.com" })
      .when("on_success")
      .allowFailure(false)
      .tags(["docker"])
      .needs(["build"])
      .dependencies(["build"])
      .timeout("1h")
      .retry({ max: 2 })
      .coverage("/Coverage: \\d+\\.\\d+/")
      .interruptible(true)
      .done()

    const plain = config.getPlainObject()
    const job = plain.jobs?.complex

    expect(job?.stage).toBe("test")
    expect(job?.image).toEqual({ name: "node:20", entrypoint: ["/bin/sh"] })
    expect(job?.services).toEqual([{ name: "postgres:13" }])
    expect(job?.script).toEqual(["npm test"])
    expect(job?.before_script).toEqual(["npm ci"])
    expect(job?.after_script).toEqual(["npm run cleanup"])
    expect(job?.cache).toEqual({ paths: ["node_modules/"], key: "test" })
    expect(job?.variables).toEqual({ NODE_ENV: "test" })
    expect(job?.environment).toEqual({ name: "test", url: "https://test.example.com" })
    expect(job?.when).toBe("on_success")
    expect(job?.allow_failure).toBe(false)
    expect(job?.tags).toEqual(["docker"])
    expect(job?.needs).toEqual(["build"])
    expect(job?.dependencies).toEqual(["build"])
    expect(job?.timeout).toBe("1h")
    expect(job?.retry).toEqual({ max: 2 })
    expect(job?.coverage).toBe("/Coverage: \\d+\\.\\d+/")
    expect(job?.interruptible).toBe(true)
  })

  it("should support mixing fluent API with regular job() method", () => {
    const config = new ConfigBuilder()

    config
      .addJob("fluent")
      .stage("test")
      .script(["npm test"])
      .done()
      .job("regular", {
        stage: "build",
        script: ["npm run build"],
      })

    const plain = config.getPlainObject()
    expect(plain.jobs?.fluent).toBeDefined()
    expect(plain.jobs?.regular).toBeDefined()
  })

  it("should merge jobs when using addJob multiple times with same name", () => {
    const config = new ConfigBuilder()

    config
      .addJob("test")
      .stage("test")
      .script(["npm test"])
      .done()
      .addJob("test")
      .cache({ paths: ["node_modules/"] })
      .done()

    const plain = config.getPlainObject()
    expect(plain.jobs?.test?.stage).toBe("test")
    expect(plain.jobs?.test?.script).toEqual(["npm test"])
    expect(plain.jobs?.test?.cache).toEqual({ paths: ["node_modules/"] })
  })

  it("should support complex chaining with stages and variables", () => {
    const config = new ConfigBuilder()

    config
      .stages("build", "test", "deploy")
      .variables({ CI_DEBUG: "true" })
      .addTemplate(".base")
      .image("alpine:latest")
      .addJob("build")
      .stage("build")
      .extends(".base")
      .script(["echo building"])
      .addJob("test")
      .stage("test")
      .extends(".base")
      .script(["echo testing"])
      .done()

    const plain = config.getPlainObject()
    expect(plain.stages).toEqual(["build", "test", "deploy"])
    expect(plain.variables).toEqual({ CI_DEBUG: "true" })
    expect(plain.jobs?.[".base"]).toBeDefined()
    expect(plain.jobs?.build).toBeDefined()
    expect(plain.jobs?.test).toBeDefined()
  })

  describe("job properties coverage", () => {
    it("should set parallel as number", () => {
      const config = new ConfigBuilder().stages("test").job("test", {
        stage: "test",
        parallel: 5,
        script: ["test.sh"],
      })

      const yaml = config.toYaml()
      expect(yaml).toContain("parallel: 5")
    })

    it("should set trigger as string (project path)", () => {
      const config = new ConfigBuilder().stages("deploy").job("trigger-downstream", {
        stage: "deploy",
        trigger: "my-group/my-project",
      })

      const yaml = config.toYaml()
      expect(yaml).toContain("trigger: my-group/my-project")
    })

    it("should set trigger as object with include", () => {
      const config = new ConfigBuilder().stages("deploy").job("trigger-child", {
        stage: "deploy",
        trigger: {
          include: ".gitlab-ci-child.yml",
          strategy: "depend",
        },
      })

      const yaml = config.toYaml()
      expect(yaml).toContain("trigger:")
      expect(yaml).toContain("include: .gitlab-ci-child.yml")
      expect(yaml).toContain("strategy: depend")
    })

    it("should set trigger with project object", () => {
      const config = new ConfigBuilder().stages("deploy").job("trigger", {
        stage: "deploy",
        trigger: {
          project: "group/project",
          branch: "main",
        },
      })

      const yaml = config.toYaml()
      expect(yaml).toContain("project: group/project")
      expect(yaml).toContain("branch: main")
    })

    it("should set id_tokens configuration", () => {
      const config = new ConfigBuilder().stages("deploy").job("deploy", {
        stage: "deploy",
        script: ["deploy.sh"],
        id_tokens: {
          ID_TOKEN: {
            aud: "https://example.com",
          },
        },
      })

      const yaml = config.toYaml()
      expect(yaml).toContain("id_tokens:")
      expect(yaml).toContain("ID_TOKEN:")
      expect(yaml).toContain("aud: https://example.com")
    })

    it("should set parallel with matrix", () => {
      const config = new ConfigBuilder().stages("test").job("test", {
        stage: "test",
        script: ["test.sh"],
        parallel: {
          matrix: [
            { PROVIDER: "aws", STACK: ["monitoring"] },
            { PROVIDER: "gcp", STACK: ["backup"] },
          ],
        },
      })

      const yaml = config.toYaml()
      expect(yaml).toContain("parallel:")
      expect(yaml).toContain("matrix:")
      expect(yaml).toContain("PROVIDER: aws")
    })
  })
})
