---
"@noxify/gitlab-ci-builder": minor
---

Add CLI visualization tool for GitLab CI pipelines

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
