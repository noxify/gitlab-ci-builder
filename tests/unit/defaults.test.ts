import { beforeEach, describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - defaults", () => {
  let config: ConfigBuilder

  beforeEach(() => {
    config = new ConfigBuilder()
  })

  it("should set default values", () => {
    config.defaults({
      image: "node:22",
      tags: ["docker"],
    })
    const result = config.getPlainObject()

    expect(result.default?.image).toBe("node:22")
    expect(result.default?.tags).toEqual(["docker"])
  })

  it("should merge defaults", () => {
    config.defaults({ image: "node:22" })
    config.defaults({ tags: ["docker"] })
    const result = config.getPlainObject()

    expect(result.default?.image).toBe("node:22")
    expect(result.default?.tags).toEqual(["docker"])
  })

  it("should return this for chaining", () => {
    const result = config.defaults({ image: "node:22" })
    expect(result).toBe(config)
  })
})
