---
"@noxify/gitlab-ci-builder": minor
---

Add child pipeline visualization and fluent API support

**New Features:**

- Added `childPipeline()` method to define child pipelines via callback API
- Added `writeYamlFiles()` method to automatically write parent and all child pipeline YAML files
- Child pipelines are now fully visualized in Mermaid diagrams, ASCII trees, and stage tables
- Child pipelines defined via callback are tracked and don't require filesystem access for visualization

**API Changes:**

- Added `ChildPipelineConfig` interface to track child pipeline configurations
- Extended `PipelineState` with `childPipelines` map and getter methods
- Added public getters to `ConfigBuilder`: `jobs`, `templates`, `stages`, `jobOptionsMap`
- Extended `VisualizationParams` with `trackedChildPipelines` parameter
- Enhanced `extractChildPipelines` to prioritize tracked configs over file system parsing

**Visualization Enhancements:**

- `generateMermaidDiagram` shows child pipelines as subgraphs with dotted trigger edges
- `generateAsciiTree` displays child pipelines with 🔀 indicator
- `generateStageTable` includes child pipeline jobs with separator rows and proper indentation
- Added `TriggerInfo` interface to track trigger configurations in `ExtendsGraphNode`
- Extended `buildExtendsGraph` to extract trigger information from job definitions

**Example:**

```typescript
config.childPipeline(
  "trigger:deploy",
  (child) => {
    child.stages("deploy")
    child.job("deploy:prod", { script: ["./deploy.sh"] })
    return child
  },
  {
    strategy: "depend",
    outputPath: "ci/deploy-pipeline.yml",
  },
)

await config.writeYamlFiles(".")
// Writes: .gitlab-ci.yml + ci/deploy-pipeline.yml
```
