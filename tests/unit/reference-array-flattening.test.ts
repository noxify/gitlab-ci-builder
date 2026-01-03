import { describe, expect, it } from "vitest"

import { convertYamlToConfig } from "../../src/resolver/cli"

describe("Reference Array Flattening", () => {
  it("should flatten arrays from !reference tags", () => {
    const yaml = `
.base_script:
  script:
    - echo 'first'
    - echo 'second'

test_job:
  script:
    - !reference [.base_script, script]
    - echo 'third'
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })
    const testJob = plain.jobs?.test_job

    expect(testJob).toBeDefined()
    expect(testJob?.script).toBeDefined()

    // The script should be flattened, not nested
    if (Array.isArray(testJob?.script)) {
      expect(testJob.script).toEqual(["echo 'first'", "echo 'second'", "echo 'third'"])
      // Should NOT be: [["echo 'first'", "echo 'second'"], "echo 'third'"]
    } else {
      throw new Error("Script should be an array")
    }
  })

  it("should flatten multiple !reference tags in the same array", () => {
    const yaml = `
.before:
  script:
    - echo 'before'

.after:
  script:
    - echo 'after'

test_job:
  script:
    - !reference [.before, script]
    - echo 'middle'
    - !reference [.after, script]
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })
    const testJob = plain.jobs?.test_job

    expect(testJob).toBeDefined()
    if (Array.isArray(testJob?.script)) {
      expect(testJob.script).toEqual(["echo 'before'", "echo 'middle'", "echo 'after'"])
    } else {
      throw new Error("Script should be an array")
    }
  })

  it("should flatten complex before_script and after_script references", () => {
    const yaml = `
.secret_management:
  before_script:
    - echo 'load secrets'
    - echo 'configure auth'

.cleanup:
  after_script:
    - echo 'cleanup started'

test_job:
  before_script:
    - !reference [.secret_management, before_script]
    - echo 'custom setup'
  script:
    - echo 'main script'
  after_script:
    - echo 'custom cleanup'
    - !reference [.cleanup, after_script]
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })
    const testJob = plain.jobs?.test_job

    expect(testJob).toBeDefined()

    if (Array.isArray(testJob?.before_script)) {
      expect(testJob.before_script).toEqual([
        "echo 'load secrets'",
        "echo 'configure auth'",
        "echo 'custom setup'",
      ])
    } else {
      throw new Error("before_script should be an array")
    }

    if (Array.isArray(testJob.after_script)) {
      expect(testJob.after_script).toEqual(["echo 'custom cleanup'", "echo 'cleanup started'"])
    } else {
      throw new Error("after_script should be an array")
    }
  })
})
