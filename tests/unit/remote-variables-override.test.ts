import { describe, expect, it } from "vitest"

import { convertYamlToConfig } from "../../src/resolver/cli"

describe("Variable and Job Merge Order", () => {
  it("should allow child definitions to override parent definitions in extends", () => {
    const yaml = `
.base:
  variables:
    SHARED_VAR: "parent-value"
    PARENT_ONLY: "parent"
  script:
    - echo "parent script"

child_job:
  extends: .base
  variables:
    SHARED_VAR: "child-override"
    CHILD_ONLY: "child"
  script:
    - echo "child script"
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })

    expect(plain.jobs?.child_job).toBeDefined()

    // Child variables should override parent variables
    expect(plain.jobs?.child_job?.variables?.SHARED_VAR).toBe("child-override")
    expect(plain.jobs?.child_job?.variables?.PARENT_ONLY).toBe("parent")
    expect(plain.jobs?.child_job?.variables?.CHILD_ONLY).toBe("child")

    // Scripts should be concatenated (parent first, child appended)
    expect(plain.jobs?.child_job?.script).toEqual(['echo "parent script"', 'echo "child script"'])
  })

  it("should handle multi-level extends with proper override order", () => {
    const yaml = `
.base:
  variables:
    VAR: "base"

.middle:
  extends: .base
  variables:
    VAR: "middle"

.top:
  extends: .middle
  variables:
    VAR: "top"

final_job:
  extends: .top
  script: echo "final"
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })

    // Most specific definition should win for variables
    expect(plain.jobs?.final_job?.variables?.VAR).toBe("top")
    expect(plain.jobs?.final_job?.script).toEqual(['echo "final"'])
  })

  it("should handle array extends with proper merge order", () => {
    const yaml = `
.base1:
  variables:
    VAR1: "from-base1"
    SHARED: "base1"

.base2:
  variables:
    VAR2: "from-base2"
    SHARED: "base2"

job:
  extends:
    - .base1
    - .base2
  variables:
    SHARED: "job-override"
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })

    // Job's own definition should override all extends
    expect(plain.jobs?.job?.variables?.SHARED).toBe("job-override")
    // Variables from both base templates should be present
    expect(plain.jobs?.job?.variables?.VAR1).toBe("from-base1")
    expect(plain.jobs?.job?.variables?.VAR2).toBe("from-base2")
  })

  it("should properly merge rules with replace strategy", () => {
    const yaml = `
.base:
  rules:
    - if: $CI_COMMIT_BRANCH == "develop"
      when: always

job_with_override:
  extends: .base
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: on_success
  script: echo "test"

job_without_override:
  extends: .base
  script: echo "test"
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })

    // Job with rules should completely replace parent rules
    expect(plain.jobs?.job_with_override?.rules).toEqual([
      {
        if: '$CI_COMMIT_BRANCH == "main"',
        when: "on_success",
      },
    ])

    // Job without rules should inherit parent rules
    expect(plain.jobs?.job_without_override?.rules).toEqual([
      {
        if: '$CI_COMMIT_BRANCH == "develop"',
        when: "always",
      },
    ])
  })

  it("should concatenate scripts but replace rules", () => {
    const yaml = `
.base:
  script:
    - echo "setup"
  rules:
    - when: never

job:
  extends: .base
  script:
    - echo "main"
  rules:
    - when: always
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })

    // Scripts concatenated
    expect(plain.jobs?.job?.script).toEqual(['echo "setup"', 'echo "main"'])

    // Rules replaced
    expect(plain.jobs?.job?.rules).toEqual([{ when: "always" }])
  })
})
