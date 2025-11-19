---
"@noxify/gitlab-ci-builder": minor
---

Add `asExtendedConfig` option to importer for function-based exports

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
