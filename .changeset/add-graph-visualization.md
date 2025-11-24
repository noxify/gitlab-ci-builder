---
"@noxify/gitlab-ci-builder": minor
---

Graph Visualization

**New Features: Graph Visualization**

Added powerful visualization capabilities to analyze and visualize extends relationships in your GitLab CI pipelines:

**New Methods:**

- `getExtendsGraph()` - Get the extends dependency graph for programmatic access
- `generateMermaidDiagram(options?)` - Generate Mermaid diagram for documentation/GitHub
- `generateAsciiTree(options?)` - Generate ASCII tree for terminal output
- `generateStageTable(options?)` - Generate CLI table with stages as columns

**Visualization Options:**

- `showRemote: boolean` - Show remote jobs with 🌐 indicator
- `showStages: boolean` - Include job stages in output
- `highlightCycles: boolean` - Highlight circular dependencies if detected

**Example Usage:**

```javascript
const config = new ConfigBuilder()
// ... configure your pipeline ...

// Generate individual visualizations
const mermaid = config.generateMermaidDiagram({ showStages: true })
const ascii = config.generateAsciiTree({ showRemote: true })
const table = config.generateStageTable()

console.log(mermaid) // Mermaid diagram
console.log(ascii) // ASCII tree
console.log(table) // Stage table
```

This feature is especially useful for:

- Documenting complex CI configurations
- Debugging extends chains and dependencies
- Understanding job relationships at a glance
- Detecting circular dependencies visually
