---
"@noxify/gitlab-ci-builder": major
---

Major Release: Improved Type Safety and GitLab CI Compatibility

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
