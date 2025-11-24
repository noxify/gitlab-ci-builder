import { beforeEach, describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - spec", () => {
  let config: ConfigBuilder

  beforeEach(() => {
    config = new ConfigBuilder()
  })

  it("should set spec with inputs", () => {
    config.spec({
      inputs: {
        environment: {
          type: "string",
          default: "production",
          description: "Target environment",
          options: ["development", "staging", "production"],
        },
        version: {
          type: "string",
          description: "Application version",
        },
        debug: {
          type: "boolean",
          default: false,
        },
      },
    })

    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline.spec).toBeDefined()
    expect(pipeline.spec?.inputs).toBeDefined()
    expect(pipeline.spec?.inputs?.environment).toMatchObject({
      type: "string",
      default: "production",
      description: "Target environment",
      options: ["development", "staging", "production"],
    })
    expect(pipeline.spec?.inputs?.version).toMatchObject({
      type: "string",
      description: "Application version",
    })
    expect(pipeline.spec?.inputs?.debug).toMatchObject({
      type: "boolean",
      default: false,
    })
  })

  it("should handle spec without inputs", () => {
    config.spec({})

    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline.spec).toBeDefined()
  })

  it("should handle spec with null input", () => {
    config.spec({
      inputs: {
        optional_input: null,
      },
    })

    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline.spec?.inputs?.optional_input).toBeNull()
  })
})

describe("ConfigBuilder - reserved job names", () => {
  let config: ConfigBuilder

  beforeEach(() => {
    config = new ConfigBuilder()
  })

  it("should throw error when using 'default' as job name", () => {
    expect(() => {
      config.job("default", { script: ["echo test"] })
    }).toThrow(/reserved keyword/)
  })

  it("should throw error when using 'include' as job name", () => {
    expect(() => {
      config.job("include", { script: ["echo test"] })
    }).toThrow(/reserved keyword/)
  })

  it("should throw error when using 'stages' as job name", () => {
    expect(() => {
      config.job("stages", { script: ["echo test"] })
    }).toThrow(/reserved keyword/)
  })

  it("should throw error when using 'variables' as job name", () => {
    expect(() => {
      config.job("variables", { script: ["echo test"] })
    }).toThrow(/reserved keyword/)
  })

  it("should throw error when using 'workflow' as job name", () => {
    expect(() => {
      config.job("workflow", { script: ["echo test"] })
    }).toThrow(/reserved keyword/)
  })

  it("should throw error when using 'spec' as job name", () => {
    expect(() => {
      config.job("spec", { script: ["echo test"] })
    }).toThrow(/reserved keyword/)
  })

  it("should allow 'pages' as valid job name (GitLab Pages)", () => {
    expect(() => {
      config.job("pages", { script: ["echo deploy"] })
    }).not.toThrow()

    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline.jobs).toHaveProperty("pages")
  })

  it("should allow valid job names", () => {
    expect(() => {
      config.job("build", { script: ["echo build"] })
      config.job("test", { script: ["echo test"] })
      config.job("deploy", { script: ["echo deploy"] })
    }).not.toThrow()

    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline.jobs).toHaveProperty("build")
    expect(pipeline.jobs).toHaveProperty("test")
    expect(pipeline.jobs).toHaveProperty("deploy")
  })

  it("should allow template names starting with dot even if they match reserved keywords", () => {
    expect(() => {
      config.template(".default", { script: ["echo template"] })
      config.template(".include", { script: ["echo template"] })
    }).not.toThrow()
  })
})
