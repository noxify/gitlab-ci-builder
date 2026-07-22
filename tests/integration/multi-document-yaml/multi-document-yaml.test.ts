// oxlint-disable vitest/max-expects
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import { describe, expect, it, expectTypeOf } from "vitest"

import type { ConfigBuilder } from "../../../src"
import { toYaml } from "../../../src/export"
import { fromYaml } from "../../../src/import"

const TEST_DIR = import.meta.dirname
const TEST_FILES_DIR = path.join(TEST_DIR, "test_files")
const GENERATED_DIR = path.join(TEST_DIR, ".generated")

describe("Integration: Multi-Document YAML", () => {
  it("should complete full round-trip: YAML → TS → ConfigBuilder → YAML", async () => {
    // Setup: ensure .generated directory exists and is clean
    if (existsSync(GENERATED_DIR)) {
      rmSync(GENERATED_DIR, { recursive: true, force: true })
    }
    mkdirSync(GENERATED_DIR, { recursive: true })

    // Read the multi-document YAML file
    const yamlFilePath = path.join(TEST_FILES_DIR, "simple-multi-doc.yml")
    const originalYaml = readFileSync(yamlFilePath, "utf-8")

    // Verify original YAML has content
    expect(originalYaml).toBeTruthy()
    expect(originalYaml.length).toBeGreaterThan(500)

    // Step 1: YAML → TypeScript code
    const tsCode = fromYaml(originalYaml)

    // Verify TypeScript code was generated
    expect(tsCode).toBeTruthy()
    expect(tsCode).toContain("ConfigBuilder")
    expect(tsCode.length).toBeGreaterThan(100)

    // Write TypeScript code to .generated directory
    const tsFilePath = path.join(GENERATED_DIR, "simple-multi-doc.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // Verify file was written
    expect(existsSync(tsFilePath)).toBeTruthy()

    // Step 2: Execute the generated TypeScript code to get ConfigBuilder instance
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ??
      module.config) as ConfigBuilder

    // Verify we got a ConfigBuilder-like object with expected methods
    expect(config).toBeDefined()
    expectTypeOf(config.safeValidate).toBeFunction()

    // Step 3: Build the pipeline to verify structure
    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline).toBeTruthy()
    expect(pipeline.jobs).toBeDefined()
    expect(result.errors).toHaveLength(0)

    // Verify pipeline structure matches expected jobs
    const jobNames = Object.keys(pipeline.jobs ?? {})
    expect(jobNames).toContain("build")
    expect(jobNames).toContain("test:unit")
    expect(jobNames).toContain("test:integration")
    expect(jobNames).toContain("deploy:production")

    // Step 4: Export ConfigBuilder back to YAML
    const exportedYaml = toYaml(config)

    // Verify exported YAML
    expect(exportedYaml).toBeTruthy()
    expect(exportedYaml.length).toBeGreaterThan(100)

    // Write exported YAML to .generated directory
    const exportedYamlPath = path.join(
      GENERATED_DIR,
      "simple-multi-doc-exported.yml"
    )
    writeFileSync(exportedYamlPath, exportedYaml, "utf-8")

    // Verify exported file exists
    expect(existsSync(exportedYamlPath)).toBeTruthy()

    // Step 5: Verify round-trip consistency - re-import exported YAML
    const reimportedTsCode = fromYaml(exportedYaml)
    expect(reimportedTsCode).toBeTruthy()

    // Both TypeScript codes should have similar structure
    expect(reimportedTsCode).toContain("ConfigBuilder")
    expect(reimportedTsCode).toContain("new ConfigBuilder()")

    // The reimported code should also define jobs/templates
    const originalHasJobs = tsCode.includes(".job(")
    const reimportedHasJobs = reimportedTsCode.includes(".job(")
    expect(reimportedHasJobs).toBe(originalHasJobs)
  })

  it("should handle empty .generated directory gracefully", () => {
    // Verify .generated directory exists (created by previous test or setup)
    expect(existsSync(GENERATED_DIR)).toBeTruthy()

    // Should be able to read/write without errors
    const testFile = path.join(GENERATED_DIR, "test-cleanup.txt")
    writeFileSync(testFile, "cleanup test", "utf-8")
    expect(existsSync(testFile)).toBeTruthy()

    // Cleanup
    rmSync(testFile)
    expect(existsSync(testFile)).toBeFalsy()
  })
})
