import { beforeEach, describe, expect, it, vi } from "vitest"

import { Config } from "../src/config"

describe("Config - edge cases and branches", () => {
  let cfg: Config

  beforeEach(() => {
    cfg = new Config()
    vi.restoreAllMocks()
  })

  it("throws if imported module does not export extendConfig", async () => {
    const fixtures = new URL("./fixtures", import.meta.url).pathname

    await expect(cfg.dynamicInclude(fixtures, ["no-export.mjs"])).rejects.toThrow(
      /Please export a function extendConfig/i,
    )
  })

  it("throws if extendConfig is not a function", async () => {
    const fixtures = new URL("./fixtures", import.meta.url).pathname

    await expect(cfg.dynamicInclude(fixtures, ["extend-not-fn.mjs"])).rejects.toThrow(
      /The exported extendConfig is not a function/i,
    )
  })

  it("warns when an extends target does not exist (recursivelyExtend warn path)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    // Create a job that extends a non-existent target
    cfg.job("build", { extends: ["non-existent"] })

    const out = cfg.getPlainObject()

    expect(warnSpy).toHaveBeenCalled()
    // The external extends entry remains (it's not a local job/template)
    if (!out.jobs) throw new Error("Expected jobs to be present")
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const job = out.jobs.build!
    expect(job).toBeDefined()
    expect(job.extends).toEqual(["non-existent"])
  })

  it("removes local extends entries during clear() but keeps external ones", () => {
    // Setup: local template and a job that extends both the local template and an external named one
    cfg.job(".local", { image: "node:22" })
    cfg.job("consumer", { extends: [".local", "external"] })

    const out = cfg.getPlainObject()
    if (!out.jobs) throw new Error("Expected jobs to be present")

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const consumer = out.jobs.consumer!
    // Local `.local` should be removed from extends (because it refers to a local template),
    // while `external` remains since it does not match any local job id.
    expect(consumer.extends).toEqual(["external"])
  })

  it("template respects mergeExisting=false and does not deep-merge when disabled", () => {
    // First define a template with a property
    cfg.template("base", { image: "node:22", variables: { FOO: "1" } })

    // Attempt to redefine with mergeExisting: false — this should NOT merge into existing
    cfg.template("base", { variables: { BAR: "2" } }, { mergeExisting: false })

    const out = cfg.getPlainObject()
    if (!out.jobs) throw new Error("Expected jobs to be present")

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tmpl = out.jobs[".base"]!
    // Since mergeExisting was false on the second call, we expect the original properties to remain
    expect(tmpl.image).toBe("node:22")
    // The second call should not have merged BAR into variables
    expect(tmpl.variables).toEqual({ FOO: "1" })
  })

  it("invokes patchers registered with patch() before returning plain object", () => {
    cfg.job("a", { script: ["echo a"] })

    cfg.patch((plain) => {
      // Mutate the plain object to add a marker

      // @ts-expect-error __patched does not exist on type GitLabCi
      plain.__patched = true
    })

    const out = cfg.getPlainObject()
    // @ts-expect-error __patched does not exist on type GitLabCi
    expect(out.__patched).toBe(true)
  })
})
