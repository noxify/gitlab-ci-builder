# @noxify/gitlab-ci-builder

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
