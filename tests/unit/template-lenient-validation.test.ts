// oxlint-disable vitest/max-expects
import { describe, expect, it } from "vitest"

import { convertYamlToConfig } from "../../src/resolver/cli"

describe("Template Validation", () => {
  it("should accept templates with incomplete definitions in YAML", () => {
    const yaml = `
.incomplete_template:
  stage: test
  # No script - but this should be OK for templates!

test_job:
  extends: .incomplete_template
  script: echo 'test'
`

    // Should not throw
    expect(() => {
      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      config.getPlainObject({ skipValidation: true })
    }).not.toThrow()
  })

  it("should accept templates with !reference tags", () => {
    const yaml = `
.other:
  script: echo 'base'
  image: node:20

.template_with_ref:
  script:
    - !reference [.other, script]
    - echo 'additional'
  image: !reference [.other, image]

test_job:
  extends: .template_with_ref
`

    expect(() => {
      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const plain = config.getPlainObject({ skipValidation: true })

      // Job should have resolved references
      expect(plain.jobs?.test_job).toBeDefined()
      expect(plain.jobs?.test_job?.image).toBe("node:20")
    }).not.toThrow()
  })

  it("should accept remote templates with incomplete definitions", () => {
    const yaml = `
.remote_template:
  image: node:20
  services:
    - redis:latest
  # No script - will be added by jobs that extend this template

production_job:
  extends: .remote_template
  script: echo 'deploy'
`

    expect(() => {
      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const plain = config.getPlainObject({ skipValidation: true })

      expect(plain.jobs?.production_job).toBeDefined()
      expect(plain.jobs?.production_job?.image).toBe("node:20")
    }).not.toThrow()
  })

  it("should handle templates with complex structures", () => {
    const yaml = `
.complex_template:
  image:
    name: docker:latest
    entrypoint: [/bin/sh]
  services:
    - name: postgres:14
      alias: db
  variables:
    POSTGRES_DB: test
  before_script:
    - echo 'setup'
  after_script:
    - echo 'cleanup'

test_job:
  extends: .complex_template
  script: echo 'test'
`

    expect(() => {
      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const plain = config.getPlainObject({ skipValidation: true })

      expect(plain.jobs?.test_job).toBeDefined()
      expect(plain.jobs?.test_job?.variables?.POSTGRES_DB).toBe("test")
    }).not.toThrow()
  })

  it("should successfully extend templates even when template has no script", () => {
    const yaml = `
.base:
  image: node:20
  variables:
    NODE_ENV: production

.extended_base:
  extends: .base
  tags:
    - kubernetes

deploy:
  extends: .extended_base
  script: echo 'deploying'
`

    const config = convertYamlToConfig(yaml, { resolveReferences: true })
    const plain = config.getPlainObject({ skipValidation: true })

    expect(plain.jobs?.deploy).toBeDefined()
    expect(plain.jobs?.deploy?.image).toBe("node:20")
    expect(plain.jobs?.deploy?.variables?.NODE_ENV).toBe("production")
    expect(plain.jobs?.deploy?.tags).toStrictEqual(["kubernetes"])
    expect(plain.jobs?.deploy?.script).toStrictEqual(["echo 'deploying'"])
  })
})
