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
cfg.template("base", { image: "node:18" })
// same as
// cfg.job("base", { image: "node:18" }, true)
// or
// cfg.job(".base", { image: "node:18" })

cfg.extends(".base", "unittest", {
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

## API Reference

This reference summarizes the primary `Config` API surface. Method signatures reflect
the runtime builder and are derived from the JSDoc on the source `Config` class.

- `new Config()`
  - Create a new builder instance.

- `stages(...stages: string[]): Config`
  - Add stages to the global stage list. Ensures uniqueness and preserves order.

- `addStage(stage: string): Config`
  - Convenience wrapper for adding a single stage.

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

- `template(name: string, definition: JobDefinition, options?: { mergeExisting?: boolean }): Config`
  - Define or deep-merge a hidden template job. The stored template name will have a leading `.`.

- `include(item: IncludeDefinition | IncludeDefinition[]): Config`
  - Add include entries. Accepts strings, objects or arrays and normalizes strings to
    `{ local: "..." }` or `{ remote: "https://..." }` depending on the value.

- `job(name: string, definition: JobDefinition, hidden?: boolean, options?: { mergeExisting?: boolean }): Config`
  - Create or merge a job. If `name` starts with `.` or `hidden` is true, the call delegates
    to `template()` and ensures a single leading `.` on the stored template name.

- `macro<T extends MacroArgs>(key: string, callback: (config: Config, args: T) => void): void`
  - Register a macro function for programmatic job generation.

- `from<T extends MacroArgs>(key: string, args: T): void`
  - Invoke a previously registered macro.

- `extends(fromName: string | string[], name: string, job?: JobDefinition, hidden?: boolean): void`
  - Create a job that will extend one or more templates/jobs (injects an `extends` property).

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
