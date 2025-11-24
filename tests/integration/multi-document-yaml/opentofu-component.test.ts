import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import type { ConfigBuilder } from "../../../src"
import { toYaml } from "../../../src/export"
import { fromYaml } from "../../../src/import"

const TEST_DIR = __dirname
const TEST_FILES_DIR = join(TEST_DIR, "test_files")
const GENERATED_DIR = join(TEST_DIR, ".generated")

describe("Integration: OpenTofu Component with spec.inputs", () => {
  it("should handle GitLab component with spec.inputs in round-trip", async () => {
    // Setup: ensure .generated directory exists and is clean
    if (existsSync(GENERATED_DIR)) {
      rmSync(GENERATED_DIR, { recursive: true, force: true })
    }
    mkdirSync(GENERATED_DIR, { recursive: true })

    // Read the OpenTofu component YAML file
    const yamlFilePath = join(TEST_FILES_DIR, "opentofu-apply.yml")
    const originalYaml = readFileSync(yamlFilePath, "utf-8")

    // Verify original YAML has content and spec.inputs
    expect(originalYaml).toBeTruthy()
    expect(originalYaml).toContain("spec:")
    expect(originalYaml).toContain("inputs:")

    // Step 1: YAML → TypeScript code
    const tsCode = fromYaml(originalYaml)

    // Verify TypeScript code was generated
    expect(tsCode).toBeTruthy()
    expect(tsCode).toContain("ConfigBuilder")
    expect(tsCode.length).toBeGreaterThan(500)

    // Verify spec inputs are present in generated code
    expect(tsCode).toContain(".spec(")

    // Write TypeScript code to .generated directory
    const tsFilePath = join(GENERATED_DIR, "opentofu-component.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // Verify file was written
    expect(existsSync(tsFilePath)).toBe(true)

    // Step 2: Execute the generated TypeScript code
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

    // Verify we got a ConfigBuilder-like object
    expect(config).toBeDefined()
    expect(typeof config.safeValidate).toBe("function")

    // Step 3: Build the pipeline to verify structure
    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(pipeline).toBeTruthy()

    // With interpolation support, we should have no errors
    expect(result.errors.length).toBe(0)

    // Verify spec is present in pipeline
    expect(pipeline.spec).toBeDefined()
    expect(pipeline.spec?.inputs).toBeDefined()

    // Verify expected spec inputs from OpenTofu template
    const inputs = pipeline.spec?.inputs
    expect(inputs).toBeDefined()

    if (inputs) {
      const inputKeys = Object.keys(inputs)
      expect(inputKeys.length).toBeGreaterThan(0)

      // Check for some key inputs
      expect(inputKeys).toContain("as")
      expect(inputKeys).toContain("stage")
      expect(inputKeys).toContain("opentofu_version")
    }

    // Verify jobs are present
    const jobNames = Object.keys(pipeline.jobs ?? {})
    expect(jobNames.length).toBeGreaterThan(0)

    // Step 4: Export ConfigBuilder back to YAML
    const exportedYaml = toYaml(config)

    // Verify exported YAML
    expect(exportedYaml).toBeTruthy()
    expect(exportedYaml.length).toBeGreaterThan(100)

    // Verify spec.inputs are in exported YAML
    expect(exportedYaml).toContain("spec:")
    expect(exportedYaml).toContain("inputs:")

    // Write exported YAML to .generated directory
    const exportedYamlPath = join(GENERATED_DIR, "opentofu-component-exported.yml")
    writeFileSync(exportedYamlPath, exportedYaml, "utf-8")

    // Verify exported file exists
    expect(existsSync(exportedYamlPath)).toBe(true)

    // Step 5: Verify round-trip consistency - re-import exported YAML
    const reimportedTsCode = fromYaml(exportedYaml)
    expect(reimportedTsCode).toBeTruthy()

    // Both TypeScript codes should have similar structure
    expect(reimportedTsCode).toContain("ConfigBuilder")
    expect(reimportedTsCode).toContain(".spec(")

    // Step 6: Re-execute reimported code to verify it works
    const reimportedTsPath = join(GENERATED_DIR, "opentofu-component-reimported.ts")
    writeFileSync(reimportedTsPath, reimportedTsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const reimportedModule = await import(reimportedTsPath)
    const reimportedConfig: ConfigBuilder =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (reimportedModule.default ?? reimportedModule.config) as ConfigBuilder

    const reimportedResult = reimportedConfig.safeValidate()
    const reimportedPipeline = reimportedConfig.getPlainObject({ skipValidation: true })
    expect(reimportedResult.errors.length).toBe(0)
    expect(reimportedPipeline.spec).toBeDefined()

    // Verify input counts match
    const originalInputCount = Object.keys(inputs ?? {}).length
    const reimportedInputCount = Object.keys(reimportedPipeline.spec?.inputs ?? {}).length
    expect(reimportedInputCount).toBe(originalInputCount)
  })

  it("should correctly parse spec.inputs with different types", async () => {
    // Create a custom YAML with various input types
    const customYaml = `---
spec:
  inputs:
    stage:
      type: string
      default: test
      description: Stage name
    parallel_count:
      type: number
      default: 5
    enabled:
      type: boolean
      default: true
    tags_list:
      type: array
      default: ['docker', 'linux']
    env_vars:
      default:
        NODE_ENV: production
        DEBUG: "false"
---
test-job:
  stage: $[[ inputs.stage ]]
  parallel: $[[ inputs.parallel_count ]]
  script:
    - echo "Running tests"
  tags: $[[ inputs.tags_list ]]
`

    // Parse to TypeScript
    const tsCode = fromYaml(customYaml)
    expect(tsCode).toContain(".spec(")

    // Verify different input types are handled
    expect(tsCode).toContain("stage")
    expect(tsCode).toContain("parallel_count")
    expect(tsCode).toContain("enabled")
    expect(tsCode).toContain("tags_list")
    expect(tsCode).toContain("env_vars")

    // Write and execute
    const tsFilePath = join(GENERATED_DIR, "custom-inputs.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(result.errors.length).toBe(0)

    // Verify spec inputs
    const inputs = pipeline.spec?.inputs
    expect(inputs).toBeDefined()
    expect(inputs?.stage).toBeDefined()
    expect(inputs?.parallel_count).toBeDefined()
    expect(inputs?.enabled).toBeDefined()
    expect(inputs?.tags_list).toBeDefined()
    expect(inputs?.env_vars).toBeDefined()

    // Verify default values and types
    expect(inputs?.stage?.default).toBe("test")
    expect(inputs?.parallel_count?.default).toBe(5)
    expect(inputs?.enabled?.default).toBe(true)
    expect(Array.isArray(inputs?.tags_list?.default)).toBe(true)
    expect(typeof inputs?.env_vars?.default).toBe("object")

    // Export and verify round-trip
    const exportedYaml = toYaml(config)
    expect(exportedYaml).toContain("spec:")
    expect(exportedYaml).toContain("stage:")
    expect(exportedYaml).toContain("parallel_count:")
  })

  it("should handle spec.inputs with options and regex", async () => {
    // Test inputs with options (enum-like behavior)
    const yamlWithOptions = `---
spec:
  inputs:
    environment:
      type: string
      default: staging
      description: Deployment environment
      options:
        - development
        - staging
        - production
    base_os:
      default: alpine
      options:
        - alpine
        - debian
        - '$GITLAB_OPENTOFU_BASE_IMAGE_OS'
    version_pattern:
      type: string
      regex: '^[0-9]+\\.[0-9]+\\.[0-9]+$'
      default: '1.0.0'
---
deploy-job:
  stage: deploy
  script:
    - echo "Deploying to $[[ inputs.environment ]]"
  variables:
    BASE_OS: $[[ inputs.base_os ]]
    VERSION: $[[ inputs.version_pattern ]]
`

    const tsCode = fromYaml(yamlWithOptions)
    expect(tsCode).toContain(".spec(")
    expect(tsCode).toContain("options:")
    expect(tsCode).toContain("regex:")

    // Write and execute
    const tsFilePath = join(GENERATED_DIR, "spec-with-options.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(result.errors.length).toBe(0)

    // Verify spec with options
    const inputs = pipeline.spec?.inputs
    expect(inputs?.environment?.options).toBeDefined()
    expect(inputs?.environment?.options).toContain("staging")
    expect(inputs?.environment?.options).toContain("production")

    expect(inputs?.base_os?.options).toBeDefined()
    expect(inputs?.base_os?.options).toContain("$GITLAB_OPENTOFU_BASE_IMAGE_OS")

    // Verify regex
    expect(inputs?.version_pattern?.regex).toBe("^[0-9]+\\.[0-9]+\\.[0-9]+$")

    // Verify job variables with interpolation
    expect(pipeline.jobs?.["deploy-job"]?.variables).toMatchObject({
      BASE_OS: "$[[ inputs.base_os ]]",
      VERSION: "$[[ inputs.version_pattern ]]",
    })
  })

  it("should handle jobs with interpolated names and resource_group", async () => {
    // Test dynamic job names and resource_group (from delete-state.yml)
    const yamlWithDynamicJob = `---
spec:
  inputs:
    as:
      default: cleanup-job
      description: Job name
    state_name:
      default: default
    resource_group_prefix:
      default: 'rg-'
    resource_group_name:
      default: $GITLAB_TOFU_STATE_NAME
---
'$[[ inputs.as ]]':
  stage: cleanup
  resource_group: $[[ inputs.resource_group_prefix ]]$[[ inputs.resource_group_name ]]
  variables:
    STATE: $[[ inputs.state_name ]]
  script:
    - echo "Cleanup"
`

    const tsCode = fromYaml(yamlWithDynamicJob)
    expect(tsCode).toContain(".spec(")
    expect(tsCode).toContain('job("$[[ inputs.as ]]"')

    // Write and execute
    const tsFilePath = join(GENERATED_DIR, "dynamic-job-name.ts")
    writeFileSync(tsFilePath, tsCode, "utf-8")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import(tsFilePath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const config: ConfigBuilder = (module.default ?? module.config) as ConfigBuilder

    const result = config.safeValidate()
    const pipeline = config.getPlainObject({ skipValidation: true })
    expect(result.errors.length).toBe(0)

    // Verify dynamic job name is preserved
    const jobName = "$[[ inputs.as ]]"
    expect(pipeline.jobs?.[jobName]).toBeDefined()

    // Verify resource_group with interpolation
    expect(pipeline.jobs?.[jobName]?.resource_group).toBe(
      "$[[ inputs.resource_group_prefix ]]$[[ inputs.resource_group_name ]]",
    )

    // Verify variables with interpolation
    expect(pipeline.jobs?.[jobName]?.variables).toMatchObject({
      STATE: "$[[ inputs.state_name ]]",
    })
  })
})
