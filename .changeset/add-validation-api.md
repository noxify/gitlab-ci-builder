---
"@noxify/gitlab-ci-builder": minor
---

Enhanced Validation API

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
