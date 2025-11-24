import { describe, expect, it } from "vitest"

import type { JobDefinitionNormalized } from "../../src/schema"
import { buildExtendsGraph } from "../../src/resolution/graph"
import {
  generateAllVisualizations,
  generateAsciiTree,
  generateMermaidDiagram,
  generateStageTable,
} from "../../src/resolution/visualization"

describe("Graph Visualization", () => {
  it("should generate Mermaid diagram", () => {
    const jobs: Record<string, JobDefinitionNormalized> = {
      build: {
        stage: "build",
        script: ["npm run build"],
        extends: [".node"],
      },
      test: {
        stage: "test",
        script: ["npm test"],
        extends: [".node"],
      },
      deploy: {
        stage: "deploy",
        script: ["npm run deploy"],
        extends: ["build"],
      },
    }

    const templates: Record<string, JobDefinitionNormalized> = {
      ".node": {
        image: "node:20",
        cache: {
          paths: ["node_modules/"],
        },
      },
    }

    const graph = buildExtendsGraph(jobs, templates)
    const mermaid = generateMermaidDiagram(graph, { showStages: true })

    expect(mermaid).toContain("graph TD")
    expect(mermaid).toContain("build [build]")
    expect(mermaid).toContain("test [test]")
    expect(mermaid).toContain(".node")
    expect(mermaid).toContain("-->")
  })

  it("should generate ASCII tree", () => {
    const jobs: Record<string, JobDefinitionNormalized> = {
      build: {
        stage: "build",
        script: ["npm run build"],
        extends: [".node"],
      },
      test: {
        stage: "test",
        script: ["npm test"],
        extends: [".node"],
      },
    }

    const templates: Record<string, JobDefinitionNormalized> = {
      ".node": {
        image: "node:20",
        cache: {
          paths: ["node_modules/"],
        },
      },
    }

    const graph = buildExtendsGraph(jobs, templates)
    const ascii = generateAsciiTree(graph, { showStages: true })

    expect(ascii).toContain("build")
    expect(ascii).toContain("test")
    expect(ascii).toContain(".node [T]")
    expect(ascii).toMatch(/[└├]─/)
  })

  it("should generate stage table", () => {
    const jobs: Record<string, JobDefinitionNormalized> = {
      build: {
        stage: "build",
        script: ["npm run build"],
        extends: [".node"],
      },
      test: {
        stage: "test",
        script: ["npm test"],
        extends: [".node"],
      },
      deploy: {
        stage: "deploy",
        script: ["npm run deploy"],
        extends: ["build"],
      },
    }

    const templates: Record<string, JobDefinitionNormalized> = {
      ".node": {
        image: "node:20",
      },
    }

    const graph = buildExtendsGraph(jobs, templates)
    const table = generateStageTable(graph, { showRemote: true })

    expect(table).toContain("build")
    expect(table).toContain("test")
    expect(table).toContain("deploy")
    expect(table).toContain("│")
  })

  it("should handle remote jobs in visualizations", () => {
    const jobs: Record<string, JobDefinitionNormalized> = {
      local: {
        script: ["echo local"],
        extends: ["remote"],
      },
      remote: {
        script: ["echo remote"],
      },
    }

    const jobOptions = {
      remote: { remote: true },
    }

    const graph = buildExtendsGraph(jobs, {}, jobOptions)
    const mermaid = generateMermaidDiagram(graph, { showRemote: true })
    const ascii = generateAsciiTree(graph, { showRemote: true })

    expect(mermaid).toContain("🌐")
    expect(ascii).toContain("🌐")
  })

  it("should show missing extends in ASCII tree", () => {
    const jobs: Record<string, JobDefinitionNormalized> = {
      test: {
        script: ["npm test"],
        extends: ["missing-job"],
      },
    }

    const graph = buildExtendsGraph(jobs, {})
    const ascii = generateAsciiTree(graph)

    expect(ascii).toContain("missing-job")
    expect(ascii).toContain("⚠️")
    expect(ascii).toContain("(missing)")
  })

  it("should generate all visualizations at once", () => {
    const jobs: Record<string, JobDefinitionNormalized> = {
      build: {
        stage: "build",
        script: ["npm run build"],
        extends: [".node"],
      },
      test: {
        stage: "test",
        script: ["npm test"],
        extends: [".node"],
      },
    }

    const templates: Record<string, JobDefinitionNormalized> = {
      ".node": {
        image: "node:20",
      },
    }

    const graph = buildExtendsGraph(jobs, templates)
    const all = generateAllVisualizations(graph, { showStages: true, showRemote: true })

    expect(all.mermaid).toContain("graph TD")
    expect(all.ascii).toContain("build")
    expect(all.table).toContain("build")
  })

  it("should handle complex extends chains in visualizations", () => {
    const templates: Record<string, JobDefinitionNormalized> = {
      ".base": {
        image: "alpine:latest",
      },
      ".node": {
        extends: [".base"],
        image: "node:20",
      },
      ".deploy": {
        extends: [".node"],
        script: ["echo deploying"],
      },
    }

    const jobs: Record<string, JobDefinitionNormalized> = {
      "deploy:prod": {
        stage: "deploy",
        extends: [".deploy"],
        environment: "production",
      },
    }

    const graph = buildExtendsGraph(jobs, templates)
    const ascii = generateAsciiTree(graph, { showStages: true })
    const mermaid = generateMermaidDiagram(graph, { showStages: true })

    expect(ascii).toContain(".base")
    expect(ascii).toContain(".node")
    expect(ascii).toContain(".deploy")
    expect(ascii).toContain("deploy:prod")

    expect(mermaid).toContain(".base")
    expect(mermaid).toContain(".node")
    expect(mermaid).toContain(".deploy")
  })
})
