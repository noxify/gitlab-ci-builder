/* eslint-disable no-console */
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { ConfigBuilder } from "../src"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Example: Visualizing pipelines with child pipelines
 *
 * This example demonstrates how to visualize a parent pipeline
 * that triggers child pipelines using the trigger keyword.
 *
 * Run this example:
 * ```bash
 * npx tsx examples/child-pipeline-visualization.ts
 * ```
 */

// Create parent pipeline with a trigger job
const config = new ConfigBuilder()

config.stages("build", "test", "trigger")

config.job("build:app", {
  stage: "build",
  script: ["npm run build"],
})

config.job("test:unit", {
  stage: "test",
  script: ["npm test"],
  needs: ["build:app"],
})

// Trigger a child pipeline using callback API
config.childPipeline(
  "trigger:child-tests",
  (child) => {
    child.stages("test", "deploy")

    child.job("test:unit", {
      stage: "test",
      script: ["npm run test:unit"],
    })

    child.job("test:e2e", {
      stage: "test",
      script: ["npm run test:e2e"],
    })

    child.job("deploy:staging", {
      stage: "deploy",
      script: ["npm run deploy:staging"],
      environment: "staging",
    })

    return child
  },
  {
    strategy: "depend",
    outputPath: "ci/child-tests-pipeline.yml",
    jobOptions: {
      stage: "trigger",
      needs: ["test:unit"],
    },
  },
)

console.log("🎨 Parent Pipeline Visualization\n")
console.log("=".repeat(80))
console.log()

// Generate and display visualizations
console.log("📊 Mermaid Diagram (without child pipelines):")
console.log("-".repeat(80))
console.log(
  config.generateMermaidDiagram({
    showChildPipelines: false,
  }),
)
console.log()
console.log()

console.log("📊 Mermaid Diagram (with child pipelines):")
console.log("-".repeat(80))
console.log(
  config.generateMermaidDiagram({
    showChildPipelines: true,
  }),
)
console.log()
console.log()

console.log("🌲 ASCII Tree (without child pipelines):")
console.log("-".repeat(80))
console.log(
  config.generateAsciiTree({
    showChildPipelines: false,
    showStages: true,
  }),
)
console.log()
console.log()

console.log("🌲 ASCII Tree (with child pipelines):")
console.log("-".repeat(80))
console.log(
  config.generateAsciiTree({
    showChildPipelines: true,
    showStages: true,
  }),
)
console.log()
console.log()

console.log("📋 Stage Table:")
console.log("-".repeat(80))
console.log(
  config.generateStageTable({
    showChildPipelines: true,
  }),
)
console.log()
console.log()

console.log("💾 Writing pipeline files...")
console.log("-".repeat(80))
void config
  .writeYamlFiles(".", {
    parentFilename: "example-output.gitlab-ci.yml",
  })
  .then((files) => {
    console.log(`✅ Parent: ${files.parent}`)
    for (const child of files.children) {
      console.log(`✅ Child:  ${child}`)
    }
  })
