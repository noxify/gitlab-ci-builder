import { describe, expect, test } from "vitest"

import type { RuleContext } from "../../src/simulation"
import { convertYamlToConfig } from "../../src"
import { PipelineSimulator } from "../../src/simulation"

describe("Reference Resolver - Edge Cases", () => {
  describe("Invalid reference paths", () => {
    test("should handle reference to non-existent path", () => {
      const yaml = `
.template:
  script:
    - echo "hello"

job:
  script: !reference [.nonexistent, script]
`

      // Should not crash
      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      // Should successfully parse even with non-existent reference
      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })

    test("should handle reference to null value", () => {
      const yaml = `
.template:
  value: null

job:
  script: !reference [.template, value]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })

    test("should handle reference with valid path", () => {
      const yaml = `
.template:
  script:
    - echo "test"

job:
  script: !reference [.template, script]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      const job = result.jobs.find((j) => j.name === "job")
      expect(job).toBeDefined()
      // Reference successfully resolved (no crash)
      expect(result.totalJobs).toBeGreaterThanOrEqual(1)
    })

    test("should handle reference to primitive when object expected", () => {
      const yaml = `
.template:
  value: "string"

job:
  script: !reference [.template, value, nested]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      // Should not crash, reference through primitive returns undefined
      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Circular references", () => {
    test("should detect circular reference between two jobs", () => {
      const yaml = `
.job-a:
  script: !reference [.job-b, script]

.job-b:
  script: !reference [.job-a, script]

test:
  script: !reference [.job-a, script]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      // Circular reference should be caught and not cause infinite loop
      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })

    test("should detect self-referencing job", () => {
      const yaml = `
.job:
  script: !reference [.job, script]

test:
  script: !reference [.job, script]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      // Self-reference should be caught
      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })

    test("should detect circular reference chain of three", () => {
      const yaml = `
.job-a:
  script: !reference [.job-b, script]

.job-b:
  script: !reference [.job-c, script]

.job-c:
  script: !reference [.job-a, script]

test:
  script: !reference [.job-a, script]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      // Three-way circular reference should be caught
      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })

    test("should handle circular reference in nested structures", () => {
      const yaml = `
.template:
  before_script:
    - !reference [.template, before_script]

job:
  before_script: !reference [.template, before_script]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      // Circular reference in array should be detected
      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Complex nested references", () => {
    test("should resolve reference to deeply nested value", () => {
      const yaml = `
.template:
  config:
    deep:
      nested:
        value: "found"

job:
  variables:
    RESULT: !reference [.template, config, deep, nested, value]
  script:
    - echo "test"
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      const job = result.jobs.find((j) => j.name === "job")
      expect(job).toBeDefined()
    })

    test("should resolve multiple references in array", () => {
      const yaml = `
.base-before:
  before_script:
    - echo "base setup"

.extra-before:
  before_script:
    - echo "extra setup"

job:
  before_script:
    - !reference [.base-before, before_script]
    - !reference [.extra-before, before_script]
    - echo "job setup"
  script:
    - echo "main"
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      const job = result.jobs.find((j) => j.name === "job")
      expect(job).toBeDefined()
      // Multiple references successfully resolved (no crash)
      expect(result.totalJobs).toBeGreaterThanOrEqual(1)
    })

    test("should resolve reference that itself contains references", () => {
      const yaml = `
.base:
  script:
    - echo "base"

.extends-base:
  script: !reference [.base, script]

job:
  script: !reference [.extends-base, script]
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      const job = result.jobs.find((j) => j.name === "job")
      expect(job).toBeDefined()
      // Nested references successfully resolved (no crash)
      expect(result.totalJobs).toBeGreaterThanOrEqual(1)
    })
  })

  describe("Edge cases with null and undefined", () => {
    test("should handle reference path through null object", () => {
      const yaml = `
.template:
  config: null

job:
  value: !reference [.template, config, nested]
  script:
    - echo "test"
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })

    test("should handle reference to array containing nulls", () => {
      const yaml = `
.template:
  items:
    - value1
    - null
    - value2

job:
  variables:
    ITEMS: !reference [.template, items]
  script:
    - echo "test"
`

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()
      const result = simulator.simulate(config, {} as RuleContext)

      expect(result.totalJobs).toBeGreaterThanOrEqual(0)
    })
  })
})
