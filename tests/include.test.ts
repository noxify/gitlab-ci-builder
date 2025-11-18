import { describe, expect, it } from "vitest"

import type { IncludeEntry } from "../src"
import { Config } from "../src/config"

describe("Config - include (static YAML entries)", () => {
  it("should accept a string include and serialize it as an array", () => {
    const cfg = new Config()
    cfg.include("build_jobs.yml")

    const out = cfg.getPlainObject()
    expect(out.include).toBeDefined()
    expect(out.include).toEqual([{ local: "build_jobs.yml" }])
  })

  it("should accept an object include with rules", () => {
    const cfg = new Config()
    cfg.include({ local: "build_jobs.yml", rules: [{ if: '$INCLUDE_BUILDS == "true"' }] })

    const out = cfg.getPlainObject()
    expect(out.include).toBeDefined()
    const first = out.include?.[0]
    if (!first) throw new Error("Expected include entries to be present")
    expect(first).toMatchObject({ local: "build_jobs.yml" })
    expect(first.rules).toBeDefined()
    expect(first.rules?.[0]).toMatchObject({ if: '$INCLUDE_BUILDS == "true"' })
  })

  it("should accept an array of mixed include entries", () => {
    const cfg = new Config()
    cfg.include(["a.yml", { local: "b.yml" }])

    const out = cfg.getPlainObject()
    expect(out.include).toEqual([{ local: "a.yml" }, { local: "b.yml" }])
  })

  it("should be chainable", () => {
    const cfg = new Config().include("a.yml").include({ local: "b.yml" })

    const out = cfg.getPlainObject()
    expect(out.include).toEqual([{ local: "a.yml" }, { local: "b.yml" }])
  })

  it("should normalize remote URL strings to remote includes", () => {
    const cfg = new Config()
    cfg.include("https://example.com/remote.yml")

    const out = cfg.getPlainObject()
    expect(out.include).toEqual([{ remote: "https://example.com/remote.yml" }])
  })

  it("should flatten nested arrays and normalize mixed entries", () => {
    const cfg = new Config()
    const nested: IncludeEntry[] = ["a.yml", "https://r.com/x.yml", { local: "b.yml" }, "c.yml"]
    cfg.include(nested)

    const out = cfg.getPlainObject()
    expect(out.include).toEqual([
      { local: "a.yml" },
      { remote: "https://r.com/x.yml" },
      { local: "b.yml" },
      { local: "c.yml" },
    ])
  })
})
