# @noxify/gitlab-ci-builder

## 1.4.2

### Patch Changes

- ac8da01: Add "Limitations" section to README

## 1.4.1

### Patch Changes

- 2b79ae0: Add comprehensive JSDoc documentation across the entire codebase
  - Added detailed JSDoc comments to all public APIs and internal functions
  - Included practical examples for complex methods
  - Added @see references linking to official GitLab CI/CD documentation
  - Documented all helper functions in importer, resolver, serializer, and visualization modules
  - Enhanced PipelineState class methods with parameter descriptions and usage examples
  - Improved documentation for TypeScript AST generation utilities

## 1.4.0

### Minor Changes

- 87c99cf: Improve visualization rendering with professional libraries
  - Replace custom ASCII tree rendering with `oo-ascii-tree` for better box-drawing characters
  - Replace custom table rendering with `climt` for professional CLI tables
    - Change table layout from horizontal to vertical (Stage | Job columns)
    - Display one job per row with full ext ends chains

## 1.3.0

### Minor Changes

- 280e33e: Add CLI visualization tool for GitLab CI pipelines
  - New `gitlab-ci-builder` command-line tool with `visualize` subcommand
  - Supports multiple input formats: local YAML files and remote URLs
  - Three visualization formats:
    - Mermaid diagram: Interactive flowchart visualization
    - ASCII tree: Text-based dependency tree
    - Stage table: Organized view by pipeline stages
  - Built-in support for extends resolution and dependency analysis
  - Easy to use: `npx @noxify/gitlab-ci-builder visualize .gitlab-ci.yml`

  ## CLI Usage

  ```bash
  # Visualize local YAML file (all formats)
  gitlab-ci-builder visualize .gitlab-ci.yml

  # Show only Mermaid diagram
  gitlab-ci-builder visualize .gitlab-ci.yml -f mermaid

  # Visualize remote pipeline
  gitlab-ci-builder visualize https://gitlab.com/my-org/my-project/-/raw/main/.gitlab-ci.yml

  # Show ASCII tree without stages
  gitlab-ci-builder visualize pipeline.yml -f ascii --show-stages=false
  ```

  ## Programmatic Usage

  ### Using YAML

  ```typescript
  import { visualizeYaml } from "@noxify/gitlab-ci-builder"

  const yamlContent = `
  stages: [build, test]
  build:
    stage: build
    script: npm run build
  `

  const result = await visualizeYaml(yamlContent, { format: "all" })
  console.log(result.mermaid) // Mermaid diagram
  console.log(result.ascii) // ASCII tree
  console.log(result.table) // Stage table
  ```

  ### Using ConfigBuilder - Show only local jobs

  ```typescript
  import { ConfigBuilder } from "@noxify/gitlab-ci-builder"

  const config = new ConfigBuilder()
    .stages("build", "test", "deploy")
    .template(".base", { image: "node:22" })
    .extends(".base", "build", { stage: "build", script: ["npm run build"] })
    .extends(".base", "test", { stage: "test", script: ["npm test"] })

  // Generate visualizations directly from ConfigBuilder
  const mermaid = config.generateMermaidDiagram({ showStages: true })
  const ascii = config.generateAsciiTree({ showRemotes: true })
  const table = config.generateStageTable()

  console.log(mermaid)
  console.log(ascii)
  console.log(table)
  ```

  ### Using ConfigBuilder - Resolve also configured `includes`

  ```typescript
  import { ConfigBuilder, visualizeYaml } from "@noxify/gitlab-ci-builder"

  const config = new ConfigBuilder()
    .include({ remote: "https://custom-gitlab-host.com/org/branch/spec.yml" })
    .stages("build", "test", "deploy")
    .template(".base", { image: "node:22" })
    .extends(".base", "build", { stage: "build", script: ["npm run build"] })
    .extends(".base", "test", { stage: "test", script: ["npm test"] })

  const yaml = config.toYaml()
  const result = await visualizeYaml(yaml, {
    format: "all",
    // Optional: Authentication for private repositories
    gitlabToken: process.env.GITLAB_TOKEN,
    // Optional: GitLab host URL for project/template includes (default: https://gitlab.com)
    gitlabUrl: "https://custom-gitlab-host.com",
  })

  console.log(result.mermaid)
  console.log(result.ascii)
  console.log(result.table)
  ```

## 1.2.0

### Minor Changes

- 712ec0d: Fluent Job Builder API

  **New Feature: Fluent Job Builder API**

  Added a powerful fluent builder interface for defining jobs and templates with chainable methods:

  **New Methods:**
  - `addJob(name)` - Create a new job with fluent builder interface
  - `addTemplate(name)` - Create a new template with fluent builder interface

  **JobBuilder Methods:**
  Common properties:
  - `stage(stage)` - Set job stage
  - `extends(extend)` - Set extends
  - `image(image)` - Set image
  - `script(script)` - Set script
  - `beforeScript(script)` - Set before_script
  - `afterScript(script)` - Set after_script
  - `services(services)` - Set services
  - `cache(cache)` - Set cache
  - `artifacts(artifacts)` - Set artifacts
  - `setVariables(vars)` - Set job variables
  - `environment(env)` - Set environment
  - `when(when)` - Set when condition
  - `rules(rules)` - Set rules
  - `needs(needs)` - Set needs
  - `tags(tags)` - Set tags
  - `allowFailure(bool)` - Set allow_failure
  - `timeout(timeout)` - Set timeout
  - `retry(retry)` - Set retry
  - `parallel(parallel)` - Set parallel
  - `trigger(trigger)` - Set trigger
  - `coverage(pattern)` - Set coverage pattern
  - `dependencies(deps)` - Set dependencies
  - `resourceGroup(group)` - Set resource_group
  - `release(release)` - Set release
  - `interruptible(bool)` - Set interruptible
  - `idTokens(tokens)` - Set id_tokens

  Utility methods:
  - `set(props)` - Bulk set multiple properties at once
  - `jobOptions(opts)` - Set job options (remote, mergeExtends, etc.)
  - `remote(bool)` - Mark job as remote
  - `mergeExtends(bool)` - Control extends merging
  - `resolveTemplatesOnly(bool)` - Control template resolution
  - `done()` - Finalize job and return to ConfigBuilder

  **Auto-Return Behavior:**
  When you call `addJob()` or `addTemplate()` from a JobBuilder, the previous job is automatically saved and a new builder is returned:

  ```typescript
  const config = new ConfigBuilder()

  // Fluent API with auto-return
  config
    .stages("build", "test", "deploy")
    .addTemplate(".node")
    .image("node:20")
    .cache({ paths: ["node_modules/"] })
    .addJob("test")
    .stage("test")
    .extends(".node")
    .script(["npm test"])
    .addJob("build")
    .stage("build")
    .extends(".node")
    .script(["npm run build"])
    .addJob("deploy")
    .stage("deploy")
    .extends("build")
    .script(["kubectl apply -f k8s/"])
    .when("manual")
    .done()

  // Or use done() to explicitly return to ConfigBuilder
  config
    .addJob("lint")
    .stage("test")
    .script(["npm run lint"])
    .done()
    .addJob("format")
    .stage("test")
    .script(["npm run format:check"])
    .done()

  // Bulk property updates with set()
  config
    .addJob("complex")
    .set({
      stage: "test",
      image: "node:20",
      script: ["npm test"],
      cache: { paths: ["node_modules/"] },
      artifacts: { paths: ["coverage/"] },
    })
    .done()
  ```

  **Benefits:**
  - **Type-safe**: Full TypeScript support with autocomplete
  - **Readable**: Clear, declarative pipeline definitions
  - **Flexible**: Mix with existing `job()` and `template()` methods
  - **Convenient**: Auto-return behavior reduces boilerplate
  - **Powerful**: All job properties supported with dedicated methods

  This fluent API is especially useful for complex pipelines with many jobs, making the code more maintainable and easier to read.

- 712ec0d: Graph Visualization

  **New Features: Graph Visualization**

  Added powerful visualization capabilities to analyze and visualize extends relationships in your GitLab CI pipelines:

  **New Methods:**
  - `getExtendsGraph()` - Get the extends dependency graph for programmatic access
  - `generateMermaidDiagram(options?)` - Generate Mermaid diagram for documentation/GitHub
  - `generateAsciiTree(options?)` - Generate ASCII tree for terminal output
  - `generateStageTable(options?)` - Generate CLI table with stages as columns

  **Visualization Options:**
  - `showRemote: boolean` - Show remote jobs with 🌐 indicator
  - `showStages: boolean` - Include job stages in output
  - `highlightCycles: boolean` - Highlight circular dependencies if detected

  **Example Usage:**

  ```javascript
  const config = new ConfigBuilder()
  // ... configure your pipeline ...

  // Generate individual visualizations
  const mermaid = config.generateMermaidDiagram({ showStages: true })
  const ascii = config.generateAsciiTree({ showRemote: true })
  const table = config.generateStageTable()

  console.log(mermaid) // Mermaid diagram
  console.log(ascii) // ASCII tree
  console.log(table) // Stage table
  ```

  This feature is especially useful for:
  - Documenting complex CI configurations
  - Debugging extends chains and dependencies
  - Understanding job relationships at a glance
  - Detecting circular dependencies visually

- 712ec0d: Enhanced Validation API

  **New Feature: Enhanced Validation API**

  Added dedicated validation methods for better control over pipeline validation:

  **New Methods:**
  - `validate()` - Validate pipeline and throw errors if validation fails (logs warnings to console)
  - `safeValidate()` - Validate pipeline without throwing errors, returns validation result with `{ valid, errors, warnings }`

  **Enhanced Methods:**
  - `getPlainObject(options?)` - Now accepts `{ skipValidation?: boolean }` option to skip validation when you've already validated separately
  - `toJSON(options?)` - Now accepts `{ skipValidation?: boolean }` option
  - `toYaml(options?)` - Now accepts `{ skipValidation?: boolean }` option

  **Breaking Changes:**
  - `finalize()` is now `private` - use `safeValidate()` for programmatic validation or `validate()` for validation that throws errors

  **Usage Examples:**

  ```typescript
  // Standard validation (throws on error)
  config.validate()
  const pipeline = config.getPlainObject({ skipValidation: true })

  // Safe validation (no throw)
  const result = config.safeValidate()
  if (!result.valid) {
    console.error("Validation errors:", result.errors)
    return
  }
  if (result.warnings.length > 0) {
    console.warn("Warnings:", result.warnings)
  }
  const pipeline = config.getPlainObject({ skipValidation: true })

  // Quick validation (default behavior)
  const pipeline = config.getPlainObject() // validates automatically
  ```

  **Benefits:**
  - **Separation of concerns**: Validation is now separate from pipeline retrieval
  - **Better error handling**: `safeValidate()` enables programmatic error handling without try/catch
  - **Performance**: Skip validation when using multiple output methods (`toYaml()`, `toJSON()`, etc.)
  - **Flexible**: Choose between throwing (`validate()`) or returning errors (`safeValidate()`)

## 1.1.1

### Patch Changes

- 118f5d4: Fixed extends resolution behavior with `resolveTemplatesOnly: true`

  Previously, when `resolveTemplatesOnly: true` was set (the default), ALL extends were removed after merging, including normal jobs and remote references that should have been preserved.

  **Old behavior (incorrect):**
  - Templates (`.prefix`) were merged ✅
  - Normal jobs (without `.`) were merged ❌ (should stay in extends)
  - Remote jobs were merged ❌ (should stay in extends)
  - Unknown/external jobs were merged ❌ (should stay in extends)

  **New behavior (correct):**
  - Templates (`.prefix`) are merged ✅
  - Normal jobs (without `.`) remain in extends ✅
  - Remote jobs remain in extends ✅
  - Unknown/external jobs remain in extends ✅

  This fix enables proper GitLab CI template composition patterns, particularly for shallow jobs that use `remote: true` to reference jobs from other configurations without merging them.

## 1.1.0

### Minor Changes

- a04d3ff: Add comprehensive test infrastructure for GitLab CI templates with local YAML storage and improve type safety for rules array access
  - Add test helper utilities for GitLab template round-trip testing
  - Add 22 official GitLab CI templates as local test fixtures
  - Add integration tests for language templates (19 tests)
  - Add integration tests for infrastructure templates (3 tests)
  - Add integration tests for browser performance artifacts (2 tests)
  - Add support for `spec` with `inputs` (GitLab CI/CD components)
  - Add integration tests for multi-document YAML with OpenTofu component
  - Add interpolation support for schema fields that can contain GitLab CI/CD variables
  - Fix TypeScript type errors in test assertions for rules array access by adding proper type guards
  - Remove 'pages' from reserved job names (it's a valid GitLab Pages job name)
  - Reorganize tests into unit and integration directories

## 1.0.0

### Major Changes

- 05df231: Major Release: Improved Type Safety and GitLab CI Compatibility

  This release brings significant improvements to type safety, extends resolution, and compatibility with complex GitLab CI configurations.

  ## Breaking Changes

  ### Architecture Refactoring

  The internal architecture has been completely refactored for better type safety and reliability:
  - **Type System**: Job definitions now use explicit input/output types (`JobDefinitionInput`, `JobDefinitionNormalized`, `JobDefinitionOutput`) instead of a single `JobDefinition` type. This provides better IntelliSense support and catches errors at compile time.
  - **Extends Resolution**: Completely rewritten extends resolution with proper topological sorting, cycle detection, and merge strategies that match GitLab CI's behavior.
  - **State Management**: New internal `PipelineState` model for cleaner separation of concerns and better maintainability.

  ### What This Means for You

  If you're using TypeScript, you may need to update type annotations that reference the old `JobDefinition` type. However, the **public API remains the same** - all existing code using `ConfigBuilder` should continue to work without changes.

  ## What's New

  ### Enhanced GitLab CI Compatibility
  - **Complex Script Support**: Full support for multiline scripts with shell operators, heredocs, and GitLab CI variables

    ```typescript
    config.job("release", {
      before_script: [
        "npm ci --cache .npm --prefer-offline",
        `{
          echo "@\${CI_PROJECT_ROOT_NAMESPACE}:registry=\${CI_API_V4_URL}/projects/\${CI_PROJECT_ID}/packages/npm/"
          echo "\${CI_API_V4_URL#https?}/projects/\${CI_PROJECT_ID}/packages/npm/:_authToken=\${CI_JOB_TOKEN}"
        } | tee -a .npmrc`,
      ],
    })
    ```

  - **Array Syntax Normalization**: Single-element arrays in `extends` are now properly normalized to strings, matching GitLab CI's behavior

    ```yaml
    # Input YAML
    job:
      extends: [.base]  # Single-element array

    # Now correctly outputs
    job:
      extends: .base    # Normalized to string
    ```

  - **Parallel Matrix Support**: Fixed schema to accept string, number, and array values for `parallel.matrix`, supporting all GitLab CI patterns
    ```typescript
    config.job("test", {
      parallel: {
        matrix: [
          { NODE_VERSION: "18" }, // String values ✓
          { PARALLEL_COUNT: 3 }, // Number values ✓
          { BROWSERS: ["chrome", "firefox"] }, // Array values ✓
        ],
      },
    })
    ```

  ### Import/Export Improvements
  - **Variable Preservation**: GitLab CI variables like `${CI_COMMIT_BRANCH}` are now correctly preserved during YAML import/export cycles
  - **Template Literal Escaping**: Fixed double-escaping bug in generated TypeScript code for multiline scripts

  ### Better Type Safety
  - **Explicit Types**: All pipeline components now have well-defined input and output types
  - **Union Type Handling**: Improved type guards for properties that can be strings or objects (like `environment`, `cache`, `needs`)
  - **Better IntelliSense**: More accurate autocomplete and type checking in your IDE

  ## Testing & Quality
  - **241 tests** covering all functionality
  - **86%+ test coverage** with comprehensive real-world use case tests
  - New test suites for:
    - Complex script handling with GitLab CI variables
    - Merge strategies and extends resolution
    - Pipeline state management
    - Real-world deployment scenarios

  ## Migration Guide

  For most users, no changes are required. However, if you have TypeScript code that references internal types:

  **Before:**

  ```typescript
  import type { JobDefinition } from "@noxify/gitlab-ci-builder"
  const job: JobDefinition = { ... }
  ```

  **After:**

  ```typescript
  import type { JobDefinitionInput } from "@noxify/gitlab-ci-builder"
  const job: JobDefinitionInput = { ... }
  ```

  The public API (`ConfigBuilder` methods, import/export functions) remains fully compatible with previous versions.

## 0.1.1

### Patch Changes

- 9db94c7: Extended `!reference` tag support to handle scalar values (e.g., `image`, `extends`) in addition to arrays, ensuring inline format without quotes for all use cases.

## 0.1.0

### Minor Changes

- 5c870cc: Add support for `artifacts.reports.annotations` property with `string | string[]` type. Import now intelligently normalizes single-element arrays to strings for cleaner generated code.
- 5229108: Add support for default export in `dynamicInclude`. Config modules can now use either `export default function(config: Config)` or the existing `export function extendConfig(config: Config)`. Default export is preferred when both are present.
- 2c0a5ba: Add support for `extends` as both `string` and `string[]`. Single extends are optimized to string format in generated code for better readability.
- d1602ed: Add support for `artifacts.reports.dotenv` property with `string | string[]` type. Import now intelligently normalizes single-element arrays to strings for cleaner generated code.
- 151d1fb: Add `asExtendedConfig` option to importer for function-based exports

  The `fromYaml()` and `importYamlFile()` functions now accept an `ImportOptions` parameter with an `asExtendedConfig` option. When set to `true`:
  - Uses `import type { Config }` instead of `import { Config }`
  - Generates a function that receives a `Config` instance as parameter
  - Exports `export default function (config: Config) { ... return config }` instead of direct config export
  - Properly indents all config calls within the function body

  This enables creating modular config extensions that can be composed together, similar to the dynamic include pattern but with full TypeScript type safety at compile time.

  **Example output with `asExtendedConfig: true`:**

  ```typescript
  import type { Config } from "@noxify/gitlab-ci-builder"

  export default function (config: Config) {
    config.stages("build", "test")

    config.job("build", {
      stage: "build",
      script: ["npm run build"],
    })

    return config
  }
  ```

- 0453041: Add flexible job configuration options with `JobOptions` interface and `globalOptions()` method.

  **New Features:**
  - **`JobOptions` interface**: Unified options object for `job()`, `template()`, and `extends()` methods with:
    - `resolveExtends?: boolean` - Control whether parent templates are resolved (default: `true`)
    - `mergeExisting?: boolean` - Control merge behavior for duplicate job names (default: `true`)
    - `hidden?: boolean` - Mark job as template (replaces boolean parameter)
  - **`globalOptions(options: GlobalOptions)` method**: Set default options for all jobs:
    - `resolveExtends?: boolean` - Disable extends resolution globally
    - `mergeExisting?: boolean` - Control default merge behavior
    - Job-level options override global settings

  **Benefits:**
  - Preserve `extends` references in output when `resolveExtends: false`
  - Fine-grained control over job merging behavior
  - Unified options interface for cleaner API

  **Example:**

  ```ts
  const config = new Config()

  // Global: disable extends resolution for all jobs
  config.globalOptions({ resolveExtends: false })

  config.template(".base", { script: ["base command"] })

  // This job keeps extends reference (global setting)
  config.job("job1", { extends: ".base" })

  // This job resolves extends (local override)
  config.job("job2", { extends: ".base" }, { resolveExtends: true })

  // Replace instead of merge
  config.job("test", { stage: "test" })
  config.job("test", { script: ["override"] }, { mergeExisting: false })
  ```

- 0f6fffc: Add support for `rules.exists` property with `string | string[]` type to match GitLab CI specification.
- 32286d9: Add support for `remote` flag on jobs and templates
  - Added `remote` option to exclude jobs/templates from merging and output

- f7412c0: Improve script formatting in YAML import with intelligent detection of shell operators.

  The import now intelligently formats `script`, `before_script`, and `after_script` properties:
  - **Simple multi-line commands** → Split into string array for better readability
  - **Line continuations** (`\`) → Preserved as template literals
  - **Shell operators** (heredoc `<<`, pipes `|`, redirects `>`, `>>`, `2>`, `<`) → Preserved as template literals
  - **Single-line commands** → Formatted as simple strings

  This produces more idiomatic and readable TypeScript code while preserving shell command semantics.

- 00274d9: Add missing `optional` property to `needs` definitions (both job and pipeline needs) to match GitLab CI specification.
- 8074252: Add missing `name` property to `workflow` definition to match GitLab CI specification.

### Patch Changes

- df32a6d: Change `dynamicInclude` config functions to return the `Config` instance for consistency with the fluent builder pattern.

  Included config files should now return the config:

  ```ts
  export default function (config: Config) {
    config.stages("build")
    return config
  }
  ```

- 99b83b0: Fixed YAML serialization of `!reference` tags to output inline format without quotes, enabling proper GitLab CI reference resolution.
- dd6b3e7: Fixed remote flag handling - internal properties are now stripped after extends resolution to ensure remote jobs/templates are correctly excluded from merging while preserving their references.
- 8f94028: Fix regression in YAML import script formatting where multi-line simple script blocks produced a nested array structure (`script: [[...]]`) instead of a flat array (`script: [ ... ]`).

  The importer now flattens multi-line simple commands correctly and preserves template literals only when shell operators (pipes, heredoc, redirects, continuations) are present.

- 6c9d68b: Improve YAML anchor handling by filtering out anchor definitions that don't contain valid job objects. This prevents type errors when importing GitLab CI files with pure anchor arrays.
- 0bf73bc: Disable log for importing file
- 1ee8b06: ensure `needsExtends` is always removed from final output

  Previously `needsExtends` (internal merge-order metadata) was only deleted in certain branches of the cleanup logic, causing it to leak into the final YAML when a job had a single remote `extends` reference. Now it's unconditionally removed from all jobs during serialization.

- 491ec44: Fix import code generation to properly handle single-element arrays for properties like `extends`, optimizing output format for better code readability.
- 83530eb: fixes problem while resolving the extends. unknown extends aren't removed now, so we can also specify remote jobs/tempates.
- 185d58d: Fix: remote flag is now internal-only
  - The `remote` option for jobs/templates is now used only for merge logic and is stripped from the final YAML output.
  - Prevents leaking internal flags into exported pipeline definitions.

- 32286d9: Rename option `resolveExtends` to `mergeExtends`
  - The option controlling whether parent templates/jobs are merged is now called `mergeExtends` (was `resolveExtends`).

- 32286d9: Add tests for resolveTemplatesOnly option
  - Added tests for global and job-level resolveTemplatesOnly

- 75edc28: Fix script parser to preserve shell control structures

  The YAML importer now correctly detects and preserves shell control structures (if/then/else/fi, for/do/done, while/do/done, until/do/done, case/esac) as template literals instead of splitting them into separate array elements.

  Previously, multi-line scripts with control structures were incorrectly split:

  ```typescript
  // Before (incorrect)
  script: ['if [ "$VAR" = "true" ]; then', 'echo "yes"', "else", 'echo "no"', "fi"]
  ```

  Now they are preserved as cohesive blocks:

  ```typescript
  // After (correct)
  script: [
    `if [ "$VAR" = "true" ]; then
    echo "yes"
  else
    echo "no"
  fi
  `,
  ]
  ```

  This ensures shell scripts with control flow are generated correctly and maintain their intended structure.

## 0.0.6

### Patch Changes

- 651d7a1: support `!reference` tag

## 0.0.5

### Patch Changes

- 1a6f848: update readme
- 1a6f848: fix ci:version and ci:publish

## 0.0.4

### Patch Changes

- 52a0098: update workflow

## 0.0.3

### Patch Changes

- fd05add: npm trusted publish

## 0.0.2

### Patch Changes

- 3b23c22: update publish config

## 0.0.1

### Patch Changes

- f9c01fe: Refactor the whole package
  - renamed `gitlab-yml` to `gitlab-ci-builder`
  - Re-implements some missing methods
  - Added tests
  - Introduces an export function ( beta )
  - Introduces an import function ( beta )
