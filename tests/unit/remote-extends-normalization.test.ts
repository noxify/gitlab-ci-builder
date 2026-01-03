import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../../src"

describe("ConfigBuilder - remote job extends normalization", () => {
  it("should normalize string extends to array when safeParse fails for remote jobs", () => {
    const config = new ConfigBuilder()

    // Add a remote job with string extends that fails validation
    // (e.g., due to other validation errors unrelated to extends)
    const remoteJobWithStringExtends = {
      extends: ".template",
      script: "echo test",
      // Add an invalid property that causes validation to fail
      invalidProperty: "this will cause safeParse to fail",
    }

    // Add as remote job - this should handle string extends gracefully
    config.job("remote-job", remoteJobWithStringExtends, { remote: true })

    // Get the plain object
    const plain = config.getPlainObject({ skipValidation: true })

    // The extends should not be split into character array
    expect(plain.jobs?.["remote-job"]?.extends).toBe(".template")
  })

  it("should not split string extends into character array during extends resolution", () => {
    const config = new ConfigBuilder({ mergeExtends: false }) // Disable extends resolution
      .template(".base", {
        script: ["echo base"],
      })
      .job(
        "job-with-extends",
        {
          extends: ".base",
          script: ["echo test"],
          // Add invalid property to trigger safeParse failure
          // @ts-expect-error - intentional invalid property
          invalidProperty: "invalid",
        },
        { remote: true, mergeExtends: false },
      )

    const plain = config.getPlainObject({ skipValidation: true })

    // Verify extends is not split into characters like ['.', 'b', 'a', 's', 'e']
    const extendsValue = plain.jobs?.["job-with-extends"]?.extends
    expect(extendsValue).toBe(".base")
    expect(typeof extendsValue).toBe("string")

    // Additional check: if it were wrongly split, it would be an array with length 5
    if (Array.isArray(extendsValue)) {
      expect(extendsValue).not.toHaveLength(5)
      expect(extendsValue).not.toEqual([".", "b", "a", "s", "e"])
    }
  })
})
