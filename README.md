# gitlab-ci-builder

A small TypeScript utility for programmatically building GitLab CI YAML objects.

This project provides a fluent `Config` API to compose GitLab pipelines in code
and output a YAML-serializable JavaScript object. It focuses on strong TypeScript
types and a simple builder surface rather than a full runtime execution engine.

## Features

- Fluent TypeScript API to declare `stages`, `jobs`, `templates`, `variables` and `include` entries
- **Import existing YAML**: Convert `.gitlab-ci.yml` files to TypeScript code using the builder API
- **Export to YAML**: Generate properly formatted YAML with customizable key ordering and spacing
- Normalizes `include` inputs (strings and arrays) into consistent objects
- Supports reusable template jobs (hidden jobs starting with `.`) and deep-merge extends
- Dynamic TypeScript-based includes: import other files and apply their `extendConfig` functions
- Small and dependency-light implementation intended for composition in build scripts

## Installation

This project is intended to be consumed from source. Install dependencies and run tests with pnpm:

```bash
pnpm install
pnpm test
```

## Quick Start

Basic usage: create a `Config`, add jobs and produce a plain object that can be serialized to YAML.

```ts
import { Config } from "./src"

const cfg = new Config()
  .stages("build", "test", "deploy")
  .variable("NODE_ENV", "production")
  .include("./common.yml")

// Template job (hidden)
config.template("base", { image: "node:18" })
// Or using job() with options:
// config.job("base", { image: "node:18" }, { hidden: true })
// Or with dot prefix:
// config.job(".base", { image: "node:18" })

config.extends(".base", "unittest", {
  stage: "test",
  script: ["npm run test"],
})

cfg.job("build", {
  stage: "build",
  script: ["npm ci", "npm run build"],
})

const plain = cfg.getPlainObject()
console.log(JSON.stringify(plain, null, 2))
```

## Import & Export

### Exporting to YAML

Convert your Config to a properly formatted YAML file:

```ts
import { Config, toYaml, writeYamlFile } from "./src"

const cfg = new Config().stages("build", "test").job("build", {
  stage: "build",
  script: ["npm run build"],
})

// Convert to YAML string
const yamlString = toYaml(cfg.getPlainObject())
console.log(yamlString)

// Or write directly to a file
await writeYamlFile(".gitlab-ci.yml", cfg.getPlainObject())
```

The YAML output features:

- Logical key ordering (workflow, include, default, variables, stages, then jobs)
- Templates listed before regular jobs
- Blank lines between top-level sections for readability
- Empty sections automatically omitted

### Importing from YAML

Convert existing `.gitlab-ci.yml` files to TypeScript code:

```ts
import { fromYaml, importYamlFile } from "./src"

// Convert YAML string to TypeScript code
const yamlContent = `
stages:
  - build
  - test

.base:
  image: node:22

build:
  extends: .base
  stage: build
  script:
    - npm run build
`

const tsCode = fromYaml(yamlContent)
console.log(tsCode)
// Output:
// import { Config } from "gitlab-ci-builder"
//
// const config = new Config()
//
// config.stages("build", "test")
//
// config.template(".base", {
//   image: "node:22",
// })
//
// config.job("build", {
//   extends: ".base",
//   stage: "build",
//   script: ["npm run build"],
// })
//
// export default config

// Or import from file and optionally write to TypeScript file
await importYamlFile(".gitlab-ci.yml", "gitlab-ci.config.ts")
```

This enables easy migration from YAML to TypeScript-based configurations.

#### YAML Anchor Handling & Extends

The import functionality handles both GitLab CI's native `extends` keyword and YAML anchors/aliases:

##### Using `extends` (Recommended)

When your YAML uses GitLab's `extends` keyword, the import preserves the reference:

```yaml
.base:
  image: node:22
  tags:
    - docker

build:
  extends: .base # GitLab CI extends
  script:
    - npm run build
```

Generated output uses `extends` property:

```ts
config.template(".base", {
  image: "node:22",
  tags: ["docker"],
})

config.job("build", {
  extends: ".base", // Preserved!
  script: ["npm run build"],
})

// Or use the extends() helper method:
config.extends(".base", "build", {
  script: ["npm run build"],
})
```

Both approaches produce equivalent output. The `extends()` helper is more concise when you want to explicitly show the inheritance relationship.

##### Using YAML Anchors & Merges

When using YAML merge operators (`<<: *anchor`), values are resolved and inlined:

- **Anchor definitions** (`&anchor_name`) containing only primitive values (arrays, strings) are filtered out
- **References** (`*anchor_name`) and **merges** (`<<: *anchor_name`) are resolved by the YAML parser and inlined
- Only anchor definitions that are valid job/template objects are included as templates

```yaml
.tags_test: &tags_test # Filtered out (array-only anchor)
  - test1
  - test2

.base: &base_config # Included (valid template)
  image: node:22
  tags:
    - docker

build:
  <<: *base_config # Values merged inline
  tags: *tags_test # Reference resolved
  script:
    - npm run build
```

Generated output has resolved values:

```ts
config.template(".base", {
  image: "node:22",
  tags: ["docker"],
})

config.job("build", {
  image: "node:22", // Inlined from .base
  tags: ["test1", "test2"], // Resolved from .tags_test
  script: ["npm run build"],
})
```

**Recommendation:** Use GitLab's `extends` keyword instead of YAML merge operators to maintain clearer relationships in the generated TypeScript code.

### Dynamic TypeScript Includes

The `dynamicInclude` method allows you to modularize your GitLab CI configuration by splitting it across multiple TypeScript files. Each included file can export a configuration function that receives the main `Config` instance.

#### Basic Usage

```ts
import { Config } from "./src"

const config = new Config()

// Include all config files from a directory
await config.dynamicInclude(process.cwd(), ["configs/**/*.ts"])

console.log(config.getPlainObject())
```

#### Creating Included Config Files

Included files can use either a **default export** (preferred) or a **named `extendConfig` export**. The exported function receives the `Config` instance, mutates it, and returns it for consistency with the fluent API.

**Option 1: Default Export (Recommended)**

````ts
**Option 1: Default Export (Recommended)**

```ts
// configs/build-jobs.ts
import type { Config } from "gitlab-ci-builder"

export default function (config: Config) {
  // Mutate the config instance directly
  config.stages("build")

  config.template(".node-base", {
    image: "node:22",
    before_script: ["npm ci"],
  })

  config.extends(".node-base", "build", {
    stage: "build",
    script: ["npm run build"],
  })

  return config
}
````

**Option 2: Named Export**

```ts
// configs/test-jobs.ts
import type { Config } from "gitlab-ci-builder"

export function extendConfig(config: Config) {
  config.stages("test")

  config.job("unit-test", {
    stage: "test",
    script: ["npm run test:unit"],
  })

  config.job("integration-test", {
    stage: "test",
    script: ["npm run test:integration"],
  })

  return config
}
```

#### Complete Example

**Main configuration file:**

```ts
// build-pipeline.ts
import { Config, writeYamlFile } from "./src"

async function main() {
  const config = new Config()

  // Set up base configuration
  config.stages("prepare", "build", "test", "deploy")
  config.variable("DOCKER_DRIVER", "overlay2")

  // Include additional configurations from separate files
  await config.dynamicInclude(process.cwd(), [
    "configs/build-jobs.ts",
    "configs/test-jobs.ts",
    "configs/deploy-jobs.ts",
  ])

  // Write the final pipeline configuration
  await writeYamlFile(".gitlab-ci.yml", config.getPlainObject())
}

main()
```

**Separate config files:**

```ts
// configs/deploy-jobs.ts
import type { Config } from "gitlab-ci-builder"

export default function (config: Config) {
  config.job("deploy-staging", {
    stage: "deploy",
    script: ["kubectl apply -f k8s/staging/"],
    environment: { name: "staging" },
    only: { refs: ["develop"] },
  })

  config.job("deploy-production", {
    stage: "deploy",
    script: ["kubectl apply -f k8s/production/"],
    environment: { name: "production" },
    only: { refs: ["main"] },
    when: "manual",
  })

  return config
}
```

#### Benefits

- **Modularity**: Split large pipelines into focused, manageable files
- **Reusability**: Share common job configurations across multiple pipelines
- **Team collaboration**: Different teams can maintain their own config files
- **Type safety**: Full TypeScript support with autocomplete and type checking

**Note:** If both default and named exports are present, the default export takes precedence.

## Job Options & Global Settings

### Job Options

The `job()`, `template()`, and `extends()` methods accept an optional `JobOptions` object for fine-grained control:

```ts
interface JobOptions {
  hidden?: boolean // Mark as template (prefix with dot)
  mergeExisting?: boolean // Merge with existing job/template (default: true)
  mergeExtends?: boolean // Merge extends (default: true)
  resolveTemplatesOnly?: boolean // Only merge templates (names starting with .)
  remote?: boolean // Mark job/template as remote (excluded from merging)
}
```

**Example:**

```ts
const config = new Config()

// Create a hidden template
config.job("base", { image: "node:22" }, { hidden: true })
// Same as: config.template(".base", { image: "node:22" })

// Replace instead of merge
config.job("build", { stage: "build", script: ["npm run build"] })
config.job("build", { script: ["npm run build:prod"] }, { mergeExisting: false })
// Result: { script: ["npm run build:prod"] } (stage removed)

// Keep extends reference (don't resolve parent)
config.template(".base", { script: ["base command"] })
config.job("child", { extends: ".base" }, { mergeExtends: false })
// Output keeps: extends: ".base"

// Only merge templates, ignore jobs without dot
config.template(".base", { script: ["template"] })
config.job("basejob", { script: ["job"] })
config.job(
  "child",
  { extends: [".base", "basejob"], stage: "test" },
  { resolveTemplatesOnly: true },
)
// Output: script: ["template"], extends removed

// Mark job/template as remote (excluded from merging)
config.job("remote-job", { script: ["do something remote"] }, { remote: true })
config.template(".remote-template", { script: ["remote template"] }, { remote: true })
// These will be ignored during merging and not appear in the output
```

### Global Options

Set default behavior for all jobs using `globalOptions()`. Job-level options override global settings:

````

```ts
const config = new Config()

// Disable extends merging globally
config.globalOptions({ mergeExtends: false })

// Only merge templates globally
config.globalOptions({ resolveTemplatesOnly: true })

config.template(".base", { script: ["base"] })
config.job("basejob", { script: ["job"] })

// This job keeps extends (global setting)
config.job("job1", { extends: ".base" })
// Output: { extends: ".base" }

// This job merges only templates (global setting)
config.job("job2", { extends: [".base", "basejob"], stage: "test" })
// Output: script: ["base"], extends removed

// This job merges all (local override)
config.job(
  "job3",
  { extends: [".base", "basejob"], stage: "test" },
  { resolveTemplatesOnly: false },
)
// Output: script: ["job", "base"], extends removed
````

**Use Cases:**

- **Preserve extends in output**: Set `mergeExtends: false` to keep GitLab CI's native `extends` keyword instead of inlining parent properties.
- **Strict replacement**: Set `mergeExisting: false` globally to prevent accidental job merging and always replace jobs/templates.
- **Conditional template resolution**: Set `resolveTemplatesOnly: true` to only merge templates (names starting with `.`), ignoring regular jobs during extends resolution.
- **Remote jobs/templates**: Set `remote: true` on individual jobs or templates to exclude them from merging and output. This is only available at the job/template level. Use this for jobs/templates defined in external includes or that should not be processed locally.
  - **Shadow-overrides for remote jobs/templates**: If a job or template is marked as `remote: true`, it will be ignored during merging and output. However, you can locally define a job/template with the same name (without `remote: true`) to override or "shadow" the remote definition. This allows you to selectively replace or extend remote jobs/templates in your local pipeline configuration.

## API Reference

This reference summarizes the primary `Config` API surface. Method signatures reflect
the runtime builder and are derived from the JSDoc on the source `Config` class.

- `new Config()`
  - Create a new builder instance.

- `stages(...stages: string[]): Config`
  - Add stages to the global stage list. Ensures uniqueness and preserves order.

- `addStage(stage: string): Config`
  - Convenience wrapper for adding a single stage.

- `globalOptions(options: GlobalOptions): Config`
  - Set global options that apply to all jobs and templates.
  - Options: `{ mergeExtends?: boolean, mergeExisting?: boolean, resolveTemplatesOnly?: boolean, remote?: boolean }`
    - Options: `{ mergeExtends?: boolean, mergeExisting?: boolean, resolveTemplatesOnly?: boolean }`
  - Job-level options override global settings.

- `workflow(workflow: GitLabCi["workflow"]): Config`
  - Set or deep-merge the top-level `workflow` configuration (typically `rules`).

- `defaults(defaults: GitLabCi["default"]): Config`
  - Set global default job parameters (deep-merged with existing defaults).

- `variable(key: string, value: string | number | boolean | undefined): Config`
  - Set a single global variable.

- `variables(vars: VariablesDefinition): Config`
  - Merge multiple global variables at once.

- `getVariable(job: string, key: string): string | number | boolean | undefined`
  - Retrieve a variable by checking job-local variables first, then global variables.

- `getJob(name: string): JobDefinition | undefined`
  - Look up a job or template definition by name (templates start with `.`).

- `template(name: string, definition: JobDefinition, options?: JobOptions): Config`
  - Define or deep-merge a hidden template job. The stored template name will have a leading `.`.
  - Options: `{ mergeExisting?: boolean, mergeExtends?: boolean, resolveTemplatesOnly?: boolean, hidden?: boolean, remote?: boolean }`

- `include(item: IncludeDefinition | IncludeDefinition[]): Config`
  - Add include entries. Accepts strings, objects or arrays and normalizes strings to
    `{ local: "..." }` or `{ remote: "https://..." }` depending on the value.

- `job(name: string, definition: JobDefinition, options?: JobOptions): Config`
  - Create or merge a job. If `name` starts with `.` or `options.hidden` is true, the call delegates
    to `template()` and ensures a single leading `.` on the stored template name.
  - Options: `{ hidden?: boolean, mergeExisting?: boolean, mergeExtends?: boolean, resolveTemplatesOnly?: boolean, remote?: boolean }`

- `macro<T extends MacroArgs>(key: string, callback: (config: Config, args: T) => void): void`
  - Register a macro function for programmatic job generation.

- `from<T extends MacroArgs>(key: string, args: T): void`
  - Invoke a previously registered macro.

- `extends(fromName: string | string[], name: string, job?: JobDefinition, options?: JobOptions): void`
  - Create a job that will extend one or more templates/jobs (injects an `extends` property).
  - Options: `{ hidden?: boolean, mergeExisting?: boolean, mergeExtends?: boolean, resolveTemplatesOnly?: boolean, remote?: boolean }`

- `dynamicInclude(cwd: string, globs: string[]): Promise<void>`
  - Import TypeScript modules matched by the provided globs and call their exported `extendConfig`.

- `patch(callback: (plain: GitLabCi) => void): void`
  - Register a patcher callback that runs on the plain object before it is returned.

- `getPlainObject(): GitLabCi`
  - Return a deep-cloned, YAML-serializable pipeline object. Templates and jobs are merged
    under the `jobs` property. The returned object has had `extends` resolved and patchers applied.

- `toJSON(): GitLabCi`
  - Alias for `getPlainObject()` (useful for `JSON.stringify`).

### Export Functions

- `toYaml(config: GitLabCi): string`
  - Convert a plain `GitLabCi` object to a formatted YAML string. Features logical key ordering,
    blank lines between sections, and proper formatting for readability.

- `writeYamlFile(filePath: string, config: GitLabCi, options?: { encoding?: BufferEncoding }): Promise<void>`
  - Write a `GitLabCi` object to a YAML file. Uses UTF-8 encoding by default.

### Import Functions

- `fromYaml(yamlContent: string): string`
  - Convert a GitLab CI YAML string to TypeScript code using the `Config` builder API.
    Parses the YAML and generates corresponding TypeScript statements.

- `importYamlFile(yamlPath: string, outputPath?: string): Promise<string>`
  - Read a GitLab CI YAML file and convert it to TypeScript code. If `outputPath` is provided,
    the generated code is written to that file. Returns the generated TypeScript code.

## Testing

The project includes unit tests run via Vitest. Run the test suite with:

```bash
pnpm test
```

## Contributing & License

Contributions welcome — open issues or PRs. This repository is published under
the same license included in the project root (`LICENSE`).

## Credits

This project is based on and inspired by the following repositories:

- `node-gitlab-ci` by devowlio: https://github.com/devowlio/node-gitlab-ci
- `gitlab-yml` by netinsight: https://github.com/netinsight/gitlab-yml

Parts of the API and types were adapted from those projects; this repository
intentionally focuses on a minimal, typed builder rather than reproducing all
runtime behaviors.

## Development Notes

Significant portions of this codebase, including the import/export functionality,
test coverage improvements, and documentation enhancements, were developed with the assistance of AI (GitHub Copilot / Claude).

While the core architecture and original implementation come from the credited repositories above,
many recent additions and refactorings were created through AI-assisted pair programming.
