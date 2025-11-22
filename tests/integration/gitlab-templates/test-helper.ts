import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, expect } from "vitest"

import type { ConfigBuilder } from "../../../src"
import { toYaml } from "../../../src/export"
import { fromYaml } from "../../../src/import"

export interface TemplateTestContext {
  generatedDir: string
  testFilesDir: string
}

export function setupTemplateTest(testDirname: string, subdirectory?: string): TemplateTestContext {
  const generatedDir = subdirectory
    ? join(testDirname, ".generated", subdirectory)
    : join(testDirname, ".generated")
  const testFilesDir = join(testDirname, "test_files")

  beforeAll(() => {
    rmSync(generatedDir, { recursive: true, force: true })
    mkdirSync(generatedDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(generatedDir, { recursive: true, force: true })
  })

  return { generatedDir, testFilesDir }
}

export async function testTemplateRoundTrip(
  templateName: string,
  yamlContent: string,
  generatedDir: string,
  options?: {
    allowMissingExtends?: boolean
    allowIncludeWarnings?: boolean
  },
) {
  const { allowMissingExtends = true, allowIncludeWarnings = true } = options ?? {}

  // Ensure generated directory exists
  mkdirSync(generatedDir, { recursive: true })

  // Import YAML to TypeScript
  const tsCode = fromYaml(yamlContent)
  expect(tsCode).toBeTruthy()
  expect(tsCode).toContain("ConfigBuilder")

  // Write TypeScript file
  const fileName = templateName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
  const tsFilePath = join(generatedDir, `${fileName}.ts`)
  writeFileSync(tsFilePath, tsCode, "utf-8")

  // Execute TypeScript to get ConfigBuilder instance
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const module = await import(tsFilePath)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

  // Validate configuration
  const result = config.finalize()

  // Filter errors based on options
  let criticalErrors = result.errors
  if (allowMissingExtends) {
    criticalErrors = criticalErrors.filter((err) => !err.message.includes("extends from missing"))
  }
  if (allowIncludeWarnings) {
    criticalErrors = criticalErrors.filter((err) => !err.message.includes("include"))
  }

  // Expect no critical errors
  if (criticalErrors.length > 0) {
    throw new Error(
      `Critical errors found:\n${criticalErrors.map((e) => `  - ${e.message}`).join("\n")}`,
    )
  }

  // Export back to YAML
  const exportedYaml = toYaml(config)
  expect(exportedYaml).toBeTruthy()

  // Verify we can re-import (full round-trip)
  const reimportedTsCode = fromYaml(exportedYaml)
  expect(reimportedTsCode).toBeTruthy()

  // Write and execute reimported code
  const reimportFilePath = join(generatedDir, `${fileName}-reimport.ts`)
  writeFileSync(reimportFilePath, reimportedTsCode, "utf-8")

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const reimportedModule = await import(reimportFilePath)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const reimportedConfig: ConfigBuilder = (reimportedModule.default ??
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    reimportedModule.config) as ConfigBuilder

  const reimportedResult = reimportedConfig.finalize()

  // Filter reimported errors
  let reimportedCriticalErrors = reimportedResult.errors
  if (allowMissingExtends) {
    reimportedCriticalErrors = reimportedCriticalErrors.filter(
      (err) => !err.message.includes("extends from missing"),
    )
  }
  if (allowIncludeWarnings) {
    reimportedCriticalErrors = reimportedCriticalErrors.filter(
      (err) => !err.message.includes("include"),
    )
  }

  if (reimportedCriticalErrors.length > 0) {
    throw new Error(
      `Critical errors in reimported config:\n${reimportedCriticalErrors.map((e) => `  - ${e.message}`).join("\n")}`,
    )
  }

  // Basic structure validation
  expect(reimportedResult.pipeline).toBeDefined()

  return {
    originalConfig: config,
    originalResult: result,
    exportedYaml,
    reimportedConfig,
    reimportedResult,
  }
}

export async function fetchTemplate(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`)
  }
  return response.text()
}

export function loadLocalTemplate(testFilesDir: string, filename: string): string {
  const filePath = join(testFilesDir, filename)
  return readFileSync(filePath, "utf-8")
}
