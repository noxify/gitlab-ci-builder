// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("needs", () => {
  it("should support needs as simple string array", () => {
    const cfg = new ConfigBuilder()

    cfg.job("build", {
      script: ["npm run build"],
    })

    cfg.job("test", {
      script: ["npm test"],
      needs: ["build"],
    })

    const plain = cfg.getPlainObject()

    expect(plain.jobs?.test?.needs).toStrictEqual(["build"])
  })

  it("should support needs with job objects", () => {
    const cfg = new ConfigBuilder()

    cfg.job("build", {
      script: ["npm run build"],
    })

    cfg.job("test", {
      script: ["npm test"],
      needs: [
        {
          job: "build",
        },
      ],
    })

    const plain = cfg.getPlainObject()

    expect(plain.jobs?.test?.needs).toStrictEqual([{ job: "build" }])
  })

  it("should support needs with artifacts property", () => {
    const cfg = new ConfigBuilder()

    cfg.job("build", {
      script: ["npm run build"],
    })

    cfg.job("test", {
      script: ["npm test"],
      needs: [
        {
          job: "build",
          artifacts: false,
        },
      ],
    })

    const plain = cfg.getPlainObject()

    expect(plain.jobs?.test?.needs).toStrictEqual([
      { job: "build", artifacts: false },
    ])
  })

  it("should support needs with optional property", () => {
    const cfg = new ConfigBuilder()

    cfg.job("generate_version", {
      script: ["echo version"],
    })

    cfg.job("unit_tests", {
      script: ["npm test"],
    })

    cfg.job("deploy", {
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

    const plain = cfg.getPlainObject()

    expect(plain.jobs?.deploy?.needs).toStrictEqual([
      { job: "generate_version", optional: true },
      { job: "unit_tests" },
    ])
  })

  it("should support needs with both optional and artifacts", () => {
    const cfg = new ConfigBuilder()

    cfg.job("build", {
      script: ["npm run build"],
    })

    cfg.job("deploy", {
      script: ["echo deploying"],
      needs: [
        {
          job: "build",
          artifacts: true,
          optional: true,
        },
      ],
    })

    const plain = cfg.getPlainObject()

    expect(plain.jobs?.deploy?.needs).toStrictEqual([
      { job: "build", artifacts: true, optional: true },
    ])
  })

  it("should support pipeline needs with optional", () => {
    const cfg = new ConfigBuilder()

    cfg.job("deploy", {
      script: ["echo deploying"],
      needs: {
        pipeline: "other-project/pipeline",
        optional: true,
      },
    })

    const plain = cfg.getPlainObject()

    expect(plain.jobs?.deploy?.needs).toStrictEqual({
      pipeline: "other-project/pipeline",
      optional: true,
    })
  })
})
