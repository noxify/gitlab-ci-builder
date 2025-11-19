---
"@noxify/gitlab-ci-builder": minor
---

Add flexible job configuration options with `JobOptions` interface and `globalOptions()` method.

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
