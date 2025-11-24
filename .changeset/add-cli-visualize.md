---
"@noxify/gitlab-ci-builder": minor
---

Add CLI visualization tool for GitLab CI pipelines

- New `gitlab-ci-builder` command-line tool with `visualize` subcommand
- Supports multiple input formats: local YAML files, remote URLs, and TypeScript config files
- Three visualization formats:
  - Mermaid diagram: Interactive flowchart visualization
  - ASCII tree: Text-based dependency tree
  - Stage table: Organized view by pipeline stages
- Built-in support for extends resolution and dependency analysis
- Easy to use: `npx @noxify/gitlab-ci-builder visualize .gitlab-ci.yml`

**CLI Usage:**

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

**Programmatic Usage:**

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

The CLI tool provides a quick way to understand complex pipeline configurations and visualize job dependencies without needing to write code. The subcommand structure allows for future expansion with additional commands. Future enhancements will include support for resolving external includes (local, remote, project, and template includes).
