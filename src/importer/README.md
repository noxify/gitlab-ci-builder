# Refactored Importer Architecture

## Overview

Clean, modular architecture for converting GitLab CI YAML to TypeScript code using the Config or ConfigBuilder API.

## Structure

```
src/refactor/importer/
├── parser.ts       # YAML parsing with custom !reference tag support
├── utils.ts        # Utility functions for categorization and validation
├── formatter.ts    # Value formatting to TypeScript code
├── generator.ts    # Code generation orchestration
└── index.ts        # Public API
```

## Modules

### parser.ts

**Purpose**: Parse YAML with GitLab CI custom tags

**Key Functions**:

- `parseYaml(yamlContent)`: Parse YAML with custom !reference tag support

### utils.ts

**Purpose**: Helper functions for YAML structure analysis

**Key Functions**:

- `isValidJobDefinition(value)`: Check if value is a valid job/template
- `hasShellOperators(value)`: Detect shell-specific patterns
- `hasControlStructures(value)`: Detect shell control structures
- `separateTopLevelAndJobs(parsed)`: Split config into top-level and jobs
- `categorizeJobs(jobs)`: Separate templates from regular jobs

**Constants**:

- `KNOWN_TOP_LEVEL_KEYS`: stages, workflow, include, variables, default, etc.
- `SCRIPT_PROPERTIES`: script, before_script, after_script
- `SINGLE_VALUE_PROPERTIES`: extends, annotations, dotenv

### formatter.ts

**Purpose**: Format values as TypeScript code

**Key Functions**:

- `formatValue(value, options)`: Format any value to TypeScript
- `formatScriptValue(value)`: Intelligent script formatting
  - Detects shell operators (|, >, >>, 2>, &>, <, \, <<)
  - Detects control structures (if/then, case/esac, for/do, while/do)
  - Single-line → string
  - Multi-line with shell patterns → template literal
  - Simple multi-line → array of strings

**Features**:

- Array formatting (inline for simple values, multi-line for complex)
- Object formatting with proper indentation
- Script flattening (expands nested arrays)
- Single-value property optimization (array[1] → string)

### generator.ts

**Purpose**: Orchestrate code generation

**Class**: `CodeGenerator`

**Options**:

- `asExtendedConfig`: Generate function-based export (default: false)
- `useConfigBuilder`: Use ConfigBuilder instead of Config (default: false)

**Methods**:

- `generate(parsed)`: Main entry point
- Private methods for each section:
  - `addImports()`: Import statements
  - `addStages(stages)`: config.stages()
  - `addWorkflow(workflow)`: config.workflow()
  - `addInclude(include)`: config.include()
  - `addVariables(variables)`: config.variables()
  - `addDefaults(defaults)`: config.defaults()
  - `addTemplates(templates)`: config.template()
  - `addJobs(jobs)`: config.job()

### index.ts

**Purpose**: Public API

**Functions**:

- `fromYaml(yamlContent, options)`: Convert YAML string to TypeScript
- `importYamlFile(yamlPath, outputPath?, options)`: Convert YAML file

**Options**:

```typescript
interface ImportOptions {
  asExtendedConfig?: boolean // Function-based export
  useConfigBuilder?: boolean // Use ConfigBuilder instead of Config
}
```

## Integration

### Legacy import.ts

Extended to support ConfigBuilder:

```typescript
export function fromYaml(yamlContent: string, options?: ImportOptions): string {
  // Use refactored implementation if ConfigBuilder is requested
  if (options?.useConfigBuilder) {
    return fromYamlRefactored(yamlContent, options)
  }

  // Otherwise use legacy implementation
  return fromYamlLegacy(yamlContent, options)
}
```

**New Option**: `useConfigBuilder?: boolean`

- When `true`: Uses ConfigBuilder from refactor module
- When `false` (default): Uses legacy Config class

## Usage Examples

### Basic Conversion

```typescript
import { fromYaml } from "@noxify/gitlab-ci-builder"

const yaml = `
stages:
  - build
  - test

build:
  stage: build
  script:
    - npm run build
`

// Legacy Config
const tsCode = fromYaml(yaml)
// Output:
// import { Config } from "@noxify/gitlab-ci-builder"
// const config = new Config()
// config.stages("build", "test")
// config.job("build", { ... })
// export default config

// New ConfigBuilder
const tsCodeBuilder = fromYaml(yaml, { useConfigBuilder: true })
// Output:
// import { ConfigBuilder } from "@noxify/gitlab-ci-builder/refactor"
// const config = new ConfigBuilder()
// config.stages("build", "test")
// config.job("build", { ... })
// export default config
```

### Extended Config (Function-based)

```typescript
const yaml = `
build:
  script:
    - npm run build
`

const tsCode = fromYaml(yaml, {
  useConfigBuilder: true,
  asExtendedConfig: true,
})
// Output:
// import type { ConfigBuilder } from "@noxify/gitlab-ci-builder/refactor"
//
// export default function (config: ConfigBuilder) {
//   config.job("build", { ... })
//
//   return config
// }
```

### Script Formatting Intelligence

```typescript
// Simple multi-line → array
const yaml1 = `
build:
  script:
    - npm install
    - npm run build
    - echo done
`
// Output: script: ["npm install", "npm run build", "echo done"]

// Shell operators → template literal
const yaml2 = `
build:
  script:
    - |
      if [ -f package.json ]; then
        npm install
      fi
`
// Output: script: [\`if [ -f package.json ]; then\\n  npm install\\nfi\`]

// Line continuation → template literal
const yaml3 = `
build:
  script:
    - >
      docker build \\
        --tag myimage \\
        .
`
// Output: script: [\`docker build \\\\\\n  --tag myimage \\\\\\n  .\`]
```

## Benefits vs Legacy

✅ **Modular**: Clean separation of concerns
✅ **Testable**: Each module can be tested independently
✅ **Maintainable**: Easy to add new features
✅ **Type-safe**: Full TypeScript support
✅ **Flexible**: Supports both Config and ConfigBuilder
✅ **Backward compatible**: Legacy code still works

## Migration Path

1. **Phase 1 (Current)**: Both implementations coexist
   - Legacy: Default behavior
   - Refactored: Opt-in via `useConfigBuilder: true`

2. **Phase 2 (Future)**: Switch defaults
   - ConfigBuilder becomes default
   - Legacy requires `useLegacyConfig: true`

3. **Phase 3 (Future)**: Remove legacy
   - Only ConfigBuilder implementation remains
   - Clean, single code path

## Testing

**Tests**:

- `importer-refactor.test.ts`: Direct refactored importer tests (9 tests)
- `import-integration.test.ts`: Integration with legacy import.ts (5 tests)
- `import.test.ts`: Legacy tests still pass (30 tests)

**Total**: 44 tests related to import functionality, all passing ✅
