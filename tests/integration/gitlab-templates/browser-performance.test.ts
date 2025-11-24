import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import type { ConfigBuilder } from "../../../src"
import { toYaml } from "../../../src/export"
import { fromYaml } from "../../../src/import"
import { setupTemplateTest } from "./test-helper"

const { generatedDir } = setupTemplateTest(import.meta.dirname, "browser-performance")

describe("Integration: GitLab Browser Performance Template", () => {
  it("should handle browser_performance artifact report", async () => {
    const yaml = `browser_performance:
  stage: performance
  image: docker:27.3
  allow_failure: true
  variables:
    DOCKER_TLS_CERTDIR: ""
    SITESPEED_IMAGE: sitespeedio/sitespeed.io
    SITESPEED_VERSION: 35.0.0
    SITESPEED_OPTIONS: ''
  services:
    - name: docker:27.3-dind
      command: ['--tls=false', '--host=tcp://0.0.0.0:2375']
  script:
    - echo "Running performance tests"
    - mv sitespeed-results/data/performance.json browser-performance.json
  artifacts:
    paths:
      - sitespeed-results/
    reports:
      browser_performance: browser-performance.json
  rules:
    - if: '$CI_COMMIT_TAG || $CI_COMMIT_BRANCH'
`

    // Import YAML
    const tsCode = fromYaml(yaml)
    expect(tsCode).toContain('config.job("browser_performance"')
    expect(tsCode).toContain("artifacts:")
    expect(tsCode).toContain("paths:")
    expect(tsCode).toContain("reports:")
    expect(tsCode).toContain("browser_performance:")

    // Write and execute
    const tsFilePath = join(generatedDir, "browser-performance.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(result.errors.length).toBe(0)

    // Verify artifacts structure
    const job = pipeline.jobs?.browser_performance
    expect(job).toBeDefined()
    expect(job?.artifacts?.paths).toEqual(["sitespeed-results/"])
    expect(job?.artifacts?.reports?.browser_performance).toBe("browser-performance.json")

    // Verify other job properties
    expect(job?.stage).toBe("performance")
    expect(job?.image).toBe("docker:27.3")
    expect(job?.allow_failure).toBe(true)
    expect(job?.variables?.SITESPEED_IMAGE).toBe("sitespeedio/sitespeed.io")

    // Export and verify round-trip
    const exportedYaml = toYaml(config)
    expect(exportedYaml).toContain("browser_performance:")
    expect(exportedYaml).toContain("artifacts:")
    expect(exportedYaml).toContain("paths:")
    expect(exportedYaml).toContain("- sitespeed-results/")
    expect(exportedYaml).toContain("reports:")
    expect(exportedYaml).toContain("browser_performance: browser-performance.json")

    // Re-import to verify full round-trip
    const reimportedTsCode = fromYaml(exportedYaml)
    writeFileSync(join(generatedDir, "browser-performance-reimport.ts"), reimportedTsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const reimportedModule = await import(join(generatedDir, "browser-performance-reimport.ts"))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const reimportedConfig: ConfigBuilder = (reimportedModule.default ??
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      reimportedModule.config) as ConfigBuilder

    const reimportedResult = reimportedConfig.safeValidate()
    const reimportedPipeline = reimportedConfig.getPlainObject({ skipValidation: true })
    expect(reimportedResult.errors.length).toBe(0)
    expect(
      reimportedPipeline.jobs?.browser_performance?.artifacts?.reports?.browser_performance,
    ).toBe("browser-performance.json")
  })

  it("should handle all artifact report types", async () => {
    const yaml = `test_job:
  stage: test
  script:
    - echo "Running tests"
  artifacts:
    paths:
      - coverage/
      - test-results/
    reports:
      junit: test-results/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura.xml
      codequality: gl-code-quality-report.json
      browser_performance: performance.json
      load_performance: load-performance.json
      sast: gl-sast-report.json
      dependency_scanning: gl-dependency-scanning-report.json
      container_scanning: gl-container-scanning-report.json
      dast: gl-dast-report.json
      terraform: tfplan.json
      dotenv: build.env
      metrics: metrics.txt
`

    const tsCode = fromYaml(yaml)
    expect(tsCode).toContain('config.job("test_job"')
    expect(tsCode).toContain("artifacts:")

    // Write and execute
    const tsFilePath = join(generatedDir, "all-reports.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(result.errors.length).toBe(0)

    // Verify all report types
    const reports = pipeline.jobs?.test_job?.artifacts?.reports
    expect(reports?.junit).toBe("test-results/junit.xml")
    expect(reports?.coverage_report).toMatchObject({
      coverage_format: "cobertura",
      path: "coverage/cobertura.xml",
    })
    expect(reports?.codequality).toBe("gl-code-quality-report.json")
    expect(reports?.browser_performance).toBe("performance.json")
    expect(reports?.load_performance).toBe("load-performance.json")
    expect(reports?.sast).toBe("gl-sast-report.json")
    expect(reports?.dependency_scanning).toBe("gl-dependency-scanning-report.json")
    expect(reports?.container_scanning).toBe("gl-container-scanning-report.json")
    expect(reports?.dast).toBe("gl-dast-report.json")
    expect(reports?.terraform).toBe("tfplan.json")
    expect(reports?.dotenv).toBe("build.env")
    expect(reports?.metrics).toBe("metrics.txt")
  })
})
