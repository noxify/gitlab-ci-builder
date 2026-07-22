// oxlint-disable vitest/max-expects
import dedent from "dedent"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  buildExtendsGraph,
  generateAsciiTree,
  generateMermaidDiagram,
  generateStageTable,
  visualizeYaml,
} from "../../src"
import type { JobDefinitionNormalized } from "../../src/schema"

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
    const resolvedConfig = { jobs }
    const mermaid = generateMermaidDiagram({
      graph,
      resolvedConfig,
      options: { showStages: true },
    })

    expect(mermaid).toContain("layout: elk")
    expect(mermaid).toContain("graph LR")
    expect(mermaid).toContain("build")
    expect(mermaid).toContain("test")
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
    const resolvedConfig = { jobs }
    const ascii = generateAsciiTree({
      graph,
      resolvedConfig,
      options: { showStages: true },
    })

    expect(ascii).toContain("build")
    expect(ascii).toContain("test")
    expect(ascii).toContain(".node [T]")
    expect(ascii).toMatch(/[└├]─/u)
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
    const resolvedConfig = { jobs, stages: ["build", "test", "deploy"] }
    const table = generateStageTable({
      graph,
      resolvedConfig,
      options: { showRemote: true },
    })

    expect(table).toContain("build")
    expect(table).toContain("test")
    expect(table).toContain("deploy")
    expect(table).toContain("|") // Markdown table separator
    expect(table).toContain("---") // Markdown table header separator
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
    const resolvedConfig = { jobs }
    const mermaid = generateMermaidDiagram({
      graph,
      resolvedConfig,
      options: { showRemote: true },
    })
    const ascii = generateAsciiTree({
      graph,
      resolvedConfig,
      options: { showRemote: true },
    })

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
    const resolvedConfig = { jobs }
    const ascii = generateAsciiTree({ graph, resolvedConfig })

    expect(ascii).toContain("missing-job")
    expect(ascii).toContain("⚠️")
    expect(ascii).toContain("(missing)")
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
    const resolvedConfig = { jobs }
    const ascii = generateAsciiTree({
      graph,
      resolvedConfig,
      options: { showStages: true },
    })
    const mermaid = generateMermaidDiagram({
      graph,
      resolvedConfig,
      options: { showStages: true },
    })

    expect(ascii).toContain(".base")
    expect(ascii).toContain(".node")
    expect(ascii).toContain(".deploy")
    expect(ascii).toContain("deploy:prod")

    expect(mermaid).toContain(".base")
    expect(mermaid).toContain(".node")
    expect(mermaid).toContain(".deploy")
  })

  describe("Mermaid Diagram Rendering", () => {
    it("should group jobs by stages when showStages is true", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
        test: {
          stage: "test",
          script: ["npm test"],
        },
        deploy: {
          stage: "deploy",
          script: ["npm run deploy"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["build", "test", "deploy"] }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showStages: true },
      })

      // Should have subgraphs for each stage
      expect(mermaid).toContain('subgraph build["build"]')
      expect(mermaid).toContain('subgraph test["test"]')
      expect(mermaid).toContain('subgraph deploy["deploy"]')
      expect(mermaid).toContain("end")
    })

    it("should create Templates subgraph for templates without stages", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
        ".node": {
          image: "node:20",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
          extends: [".node"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs, stages: ["build"] }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showStages: true },
      })

      // Should have Templates subgraph
      expect(mermaid).toContain("subgraph Templates")
      expect(mermaid).toContain(".base")
      expect(mermaid).toContain(".node")
    })

    it("should handle templates with stages in their respective stage subgraphs", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".build-template": {
          stage: "build",
          script: ["echo building"],
        },
        ".test-template": {
          stage: "test",
          script: ["echo testing"],
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        "build:app": {
          stage: "build",
          extends: [".build-template"],
        },
        "test:app": {
          stage: "test",
          extends: [".test-template"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs, stages: ["build", "test"] }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showStages: true },
      })

      // Templates with stages should be in stage subgraphs
      expect(mermaid).toContain('subgraph build["build"]')
      expect(mermaid).toContain('subgraph test["test"]')
      expect(mermaid).toContain(".build-template")
      expect(mermaid).toContain(".test-template")
      // Should NOT have Templates subgraph since all templates have stages
      expect(mermaid).not.toContain("subgraph Templates")
    })

    it("should show all extends relationships as edges", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
        ".node": {
          extends: [".base"],
          image: "node:20",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          extends: [".node"],
          script: ["npm run build"],
        },
        test: {
          stage: "test",
          extends: [".node"],
          script: ["npm test"],
        },
        deploy: {
          stage: "deploy",
          extends: ["build"],
          script: ["npm run deploy"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Count edges - should have 4 edges: build->.node, test->.node, deploy->build, .node->.base
      const edges = mermaid.match(/-->/gu)
      expect(edges).toBeDefined()
      expect(edges?.length).toBe(4)
    })

    it("should apply correct CSS classes for templates, jobs, and remote items", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".local-template": {
          image: "alpine:latest",
        },
        ".remote-template": {
          image: "node:20",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        "local-job": {
          script: ["echo local"],
          extends: [".local-template"],
        },
        "remote-job": {
          script: ["echo remote"],
          extends: [".remote-template"],
        },
      }

      const jobOptions = {
        "remote-job": { remote: true },
        ".remote-template": { remote: true },
      }

      const graph = buildExtendsGraph(jobs, templates, jobOptions)
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Check CSS classes
      expect(mermaid).toContain(":::template")
      expect(mermaid).toContain(":::job")
      expect(mermaid).toContain(":::remote")

      // Check class definitions
      expect(mermaid).toContain("classDef template")
      expect(mermaid).toContain("classDef job")
      expect(mermaid).toContain("classDef remote")
    })

    it("should handle mixed templates with and without stages", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
          // No stage
        },
        ".build-base": {
          stage: "build",
          script: ["echo building"],
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          extends: [".base", ".build-base"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs, stages: ["build"] }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showStages: true },
      })

      // Should have both Templates and build subgraphs
      expect(mermaid).toContain("subgraph Templates")
      expect(mermaid).toContain('subgraph build["build"]')
      expect(mermaid).toContain(".base")
      expect(mermaid).toContain(".build-base")
      expect(mermaid).toContain("build")
    })

    it("should use LR layout for better readability", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: { script: ["npm run build"] },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      expect(mermaid).toContain("layout: elk")
      expect(mermaid).toContain("graph LR")
    })

    it("should handle jobs without stages when showStages is false", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          script: ["npm run build"],
        },
        test: {
          script: ["npm test"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showStages: false },
      })

      // Should not have subgraphs
      expect(mermaid).not.toContain("subgraph")
      // Should have all jobs as nodes
      expect(mermaid).toContain("build")
      expect(mermaid).toContain("test")
    })

    it("should escape special characters in job names", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        'build:frontend "main"': {
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Should escape quotes
      expect(mermaid).toContain('build:frontend \\"main\\"')
    })

    it("should show remote indicator when showRemote is true", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "remote-job": {
          script: ["echo remote"],
        },
      }

      const jobOptions = {
        "remote-job": { remote: true },
      }

      const graph = buildExtendsGraph(jobs, {}, jobOptions)
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showRemote: true },
      })

      expect(mermaid).toContain("🌐")
    })

    it("should handle complex multi-level extends chains", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".level1": {
          image: "alpine:latest",
        },
        ".level2": {
          extends: [".level1"],
          before_script: ["echo level2"],
        },
        ".level3": {
          extends: [".level2"],
          before_script: ["echo level3"],
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        job: {
          stage: "test",
          extends: [".level3"],
          script: ["echo job"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Should have all nodes
      expect(mermaid).toContain(".level1")
      expect(mermaid).toContain(".level2")
      expect(mermaid).toContain(".level3")
      expect(mermaid).toContain("job")

      // Should have edges for the chain
      const edges = mermaid.match(/-->/gu)
      expect(edges).toBeDefined()
      expect(edges?.length).toBe(3) // job->.level3, .level3->.level2, .level2->.level1
    })

    it("should handle multiple extends from same job", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".cache": {
          cache: { paths: ["node_modules/"] },
        },
        ".artifacts": {
          artifacts: { paths: ["dist/"] },
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          extends: [".cache", ".artifacts"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Should have edges to both templates
      const buildNode = /n\d+\["build.*"\]/u.exec(mermaid)?.[0]
      expect(buildNode).toBeDefined()

      const edges = mermaid.match(/-->/gu)
      expect(edges).toBeDefined()
      expect(edges?.length).toBe(2) // build->.cache and build->.artifacts
    })

    it("should show missing templates with warning styling", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          extends: [".missing-template"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Should have the job
      expect(mermaid).toContain("build")

      // Should have the missing template with warning
      expect(mermaid).toContain(".missing-template ⚠️")

      // Should have dashed line styling for missing template
      expect(mermaid).toContain("stroke-dasharray: 5 5")

      // Should have edge to missing template
      expect(mermaid).toContain("-->")
    })

    it("should handle extends to templates that start with dot correctly", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          extends: [".template"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })

      // Should not have double dots
      expect(mermaid).not.toContain("..")
      expect(mermaid).toContain(".template")
    })

    it("should show both resolved and unresolved extends when different", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          extends: [".base"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)

      // Simulate include resolution by adding unresolved extends
      const buildNode = graph.get("build")
      if (buildNode) {
        buildNode.unresolvedExtends = [".original-template"]
      }

      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({ graph, resolvedConfig })
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      // Mermaid should have dotted line for unresolved extends
      expect(mermaid).toContain("-.->")
      expect(mermaid).toContain("original")

      // ASCII should show original extends
      expect(ascii).toContain("📜 original")
      expect(ascii).toContain(".original-template")
    })
  })

  describe("ASCII Tree Rendering", () => {
    it("should use oo-ascii-tree box drawing characters", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          extends: [".base"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      // Should use proper box drawing characters
      expect(ascii).toMatch(/[├└]─/u)
    })

    it("should show stages when showStages is true", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
        test: {
          stage: "test",
          script: ["npm test"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({
        graph,
        resolvedConfig,
        options: { showStages: true },
      })

      expect(ascii).toContain("(build)")
      expect(ascii).toContain("(test)")
    })

    it("should not show stages when showStages is false", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({
        graph,
        resolvedConfig,
        options: { showStages: false },
      })

      expect(ascii).not.toContain("(build)")
    })

    it("should mark templates with [T]", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          extends: [".base"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      expect(ascii).toContain(".base [T]")
      expect(ascii).not.toContain("build [T]")
    })

    it("should show remote indicator when showRemote is true", () => {
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
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({
        graph,
        resolvedConfig,
        options: { showRemote: true },
      })

      expect(ascii).toContain("remote 🌐")
    })

    it("should handle multi-level extends chains", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
        ".node": {
          extends: [".base"],
          image: "node:20",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          extends: [".node"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      // Should show the full chain
      expect(ascii).toContain("build")
      expect(ascii).toContain(".node")
      expect(ascii).toContain(".base")
    })

    it("should show missing templates with warning", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          extends: [".missing"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      expect(ascii).toContain(".missing ⚠️")
      expect(ascii).toContain("(missing)")
    })

    it("should show unresolved extends separately", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".resolved": {
          image: "alpine:latest",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          extends: [".resolved"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)

      // Simulate unresolved extends
      const buildNode = graph.get("build")
      if (buildNode) {
        buildNode.unresolvedExtends = [".original"]
      }

      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      expect(ascii).toContain("📜 original:")
      expect(ascii).toContain(".original")
    })

    it("should handle templates reused by multiple jobs", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        "build:frontend": {
          extends: [".base"],
          script: ["npm run build:frontend"],
        },
        "build:backend": {
          extends: [".base"],
          script: ["npm run build:backend"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      // Should show .base multiple times (once per branch)
      const baseMatches = ascii.match(/\.base/gu)
      expect(baseMatches).toBeDefined()
      expect(baseMatches?.length).toBeGreaterThanOrEqual(2)
    })

    it("should handle cycles gracefully", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        job1: {
          extends: ["job2"],
          script: ["echo 1"],
        },
        job2: {
          script: ["echo 2"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({ graph, resolvedConfig })

      // Should not crash and should show both jobs
      // job2 is the root (not extended by anyone), job1 extends job2
      expect(ascii).toContain("job2")
      expect(ascii).toContain("job1")
    })
  })

  describe("Stage Table Rendering", () => {
    it("should use climt table format", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["build"] }
      const table = generateStageTable({ graph, resolvedConfig })

      // Should have table separators
      expect(table).toContain("|")
      expect(table).toContain("-")
      expect(table).toContain("STAGE")
      expect(table).toContain("JOB")
    })

    it("should show one row per job", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "build:frontend": {
          stage: "build",
          script: ["npm run build:frontend"],
        },
        "build:backend": {
          stage: "build",
          script: ["npm run build:backend"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["build"] }
      const table = generateStageTable({ graph, resolvedConfig })

      // Should have both jobs
      expect(table).toContain("build:frontend")
      expect(table).toContain("build:backend")

      // Should repeat stage name for each job
      const buildMatches = table.match(/build/gu)
      expect(buildMatches).toBeDefined()
      expect(buildMatches?.length).toBeGreaterThanOrEqual(2)
    })

    it("should exclude templates from table", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          stage: "build",
          image: "alpine:latest",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          extends: [".base"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs, stages: ["build"] }
      const table = generateStageTable({ graph, resolvedConfig })

      // Should not show template as separate row
      expect(table).toContain("build")
      // .base should only appear in extends chain
      expect(table).toContain("← .base")
    })

    it("should show full extends chain", () => {
      const templates: Record<string, JobDefinitionNormalized> = {
        ".base": {
          image: "alpine:latest",
        },
        ".build": {
          extends: [".base"],
          stage: "build",
        },
      }

      const jobs: Record<string, JobDefinitionNormalized> = {
        "build:app": {
          stage: "build",
          extends: [".build"],
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, templates)
      const resolvedConfig = { jobs, stages: ["build"] }
      const table = generateStageTable({ graph, resolvedConfig })

      // Should show full chain: build:app ← .build ← .base
      expect(table).toContain("build:app ← .build ← .base")
    })

    it("should show remote indicator when showRemote is true", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "remote-job": {
          stage: "test",
          script: ["echo remote"],
        },
      }

      const jobOptions = {
        "remote-job": { remote: true },
      }

      const graph = buildExtendsGraph(jobs, {}, jobOptions)
      const resolvedConfig = { jobs, stages: ["test"] }
      const table = generateStageTable({
        graph,
        resolvedConfig,
        options: { showRemote: true },
      })

      expect(table).toContain("🌐")
    })

    it("should handle multiple stages", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
        test: {
          stage: "test",
          script: ["npm test"],
        },
        deploy: {
          stage: "deploy",
          script: ["npm run deploy"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["build", "test", "deploy"] }
      const table = generateStageTable({ graph, resolvedConfig })

      expect(table).toContain("build")
      expect(table).toContain("test")
      expect(table).toContain("deploy")
    })

    it("should handle jobs without extends", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["build"] }
      const table = generateStageTable({ graph, resolvedConfig })

      expect(table).toContain("build")
      // Should not show arrow when no extends
      expect(table).not.toContain("←")
    })

    it("should return message when no stages defined", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {}

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const table = generateStageTable({ graph, resolvedConfig })

      expect(table).toContain("No stages defined")
    })

    it("should handle multiple jobs in same stage", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "unit-tests": {
          stage: "test",
          script: ["npm run test:unit"],
        },
        "integration-tests": {
          stage: "test",
          script: ["npm run test:integration"],
        },
        "e2e-tests": {
          stage: "test",
          script: ["npm run test:e2e"],
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["test"] }
      const table = generateStageTable({ graph, resolvedConfig })

      // All jobs should be listed
      expect(table).toContain("unit-tests")
      expect(table).toContain("integration-tests")
      expect(table).toContain("e2e-tests")

      // Stage should appear for each job
      const testMatches = table.match(/test/gu)
      expect(testMatches).toBeDefined()
      expect(testMatches?.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("Remote Includes Visualization", () => {
    const restHandlers = [
      http.get("https://example.com/ci/base.yml", () =>
        HttpResponse.text(dedent`
          .base-template:
            image: alpine:latest
            cache:
              key: \${CI_COMMIT_REF_SLUG}
              paths:
                - .cache/
        `)
      ),

      http.get("https://example.com/ci/node.yml", () =>
        HttpResponse.text(dedent`
          .node-base:
            extends: .base-template
            image: node:20
            before_script:
              - npm ci
        `)
      ),

      http.get("https://example.com/ci/deploy.yml", () =>
        HttpResponse.text(dedent`
          .deploy-template:
            stage: deploy
            environment:
              name: production
            rules:
              - if: $CI_COMMIT_BRANCH == "main"
        `)
      ),
    ]

    const server = setupServer(...restHandlers)

    beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
    afterEach(() => server.resetHandlers())

    afterAll(() => server.close())

    it("should visualize pipeline with remote includes in Mermaid format", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/base.yml
          - remote: https://example.com/ci/node.yml

        stages:
          - build
          - test

        build:
          extends: .node-base
          stage: build
          script:
            - npm run build

        test:
          extends: .node-base
          stage: test
          script:
            - npm test
      `

      const result = await visualizeYaml(yaml, {
        format: "mermaid",
        showStages: true,
        showRemotes: true,
      })

      expect(result.mermaid).toBeDefined()
      expect(result.mermaid).toContain("graph LR")
      expect(result.mermaid).toContain("build")
      expect(result.mermaid).toContain("test")
      expect(result.mermaid).toContain(".node-base")
      expect(result.mermaid).toContain(".base-template")

      // Remote templates should have remote CSS class
      expect(result.mermaid).toContain(":::remote")

      // Should have stage subgraphs
      expect(result.mermaid).toContain('subgraph build["build"]')
      expect(result.mermaid).toContain('subgraph test["test"]')

      // Should have edges showing extends relationships
      expect(result.mermaid).toContain("-->")
    })

    it("should visualize pipeline with remote includes in ASCII format", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/base.yml
          - remote: https://example.com/ci/node.yml

        stages:
          - build
          - test

        build:
          extends: .node-base
          stage: build
          script:
            - npm run build

        test:
          extends: .node-base
          stage: test
          script:
            - npm test
      `

      const result = await visualizeYaml(yaml, {
        format: "ascii",
        showStages: true,
        showRemotes: true,
      })

      expect(result.ascii).toBeDefined()
      expect(result.ascii).toContain("build")
      expect(result.ascii).toContain("test")
      expect(result.ascii).toContain(".node-base")
      expect(result.ascii).toContain(".base-template")
      expect(result.ascii).toContain("[T]") // Template marker

      // Should show stage information
      expect(result.ascii).toContain("(build)")
      expect(result.ascii).toContain("(test)")

      // Should use proper box drawing characters
      expect(result.ascii).toMatch(/[├└]─/u)
    })

    it("should visualize pipeline with remote includes in table format", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/base.yml
          - remote: https://example.com/ci/deploy.yml

        stages:
          - build
          - deploy

        build:
          stage: build
          script:
            - npm run build

        deploy-prod:
          extends: .deploy-template
          stage: deploy
          script:
            - npm run deploy
      `

      const result = await visualizeYaml(yaml, {
        format: "table",
        showRemotes: true,
      })

      expect(result.table).toBeDefined()
      expect(result.table).toContain("STAGE")
      expect(result.table).toContain("JOB")
      expect(result.table).toContain("build")
      expect(result.table).toContain("deploy-prod")

      // Should show extends chain with remote template
      expect(result.table).toContain("← .deploy-template")
    })

    it("should handle complex extends chains with remote templates", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/base.yml
          - remote: https://example.com/ci/node.yml

        stages:
          - build

        .local-template:
          extends: .node-base
          cache:
            paths:
              - dist/

        build:
          extends: .local-template
          stage: build
          script:
            - npm run build
      `

      const result = await visualizeYaml(yaml, {
        format: "all",
        showStages: true,
        showRemotes: true,
      })

      // Mermaid should show full chain
      expect(result.mermaid).toBeDefined()
      expect(result.mermaid).toContain("build")
      expect(result.mermaid).toContain(".local-template")
      expect(result.mermaid).toContain(".node-base")
      expect(result.mermaid).toContain(".base-template")

      // ASCII should show full chain
      expect(result.ascii).toBeDefined()
      expect(result.ascii).toContain("build")
      expect(result.ascii).toContain(".local-template")
      expect(result.ascii).toContain(".node-base")
      expect(result.ascii).toContain(".base-template")

      // Table should show full extends chain
      expect(result.table).toBeDefined()
      expect(result.table).toContain(
        "build ← .local-template ← .node-base ← .base-template"
      )
    })

    it("should handle multiple remote includes with same template names", async () => {
      server.use(
        http.get("https://example.com/ci/team-a.yml", () =>
          HttpResponse.text(dedent`
            .shared:
              image: alpine:latest
          `)
        )
      )

      const yaml = dedent`
        include:
          - remote: https://example.com/ci/team-a.yml

        stages:
          - test

        test:
          extends: .shared
          stage: test
          script:
            - echo "testing"
      `

      const result = await visualizeYaml(yaml, {
        format: "ascii",
        showRemotes: true,
      })

      expect(result.ascii).toBeDefined()
      expect(result.ascii).toContain("test")
      expect(result.ascii).toContain(".shared")
      expect(result.ascii).toContain("[T]") // Template marker
    })

    it("should handle missing remote includes gracefully", async () => {
      server.use(
        http.get("https://example.com/ci/missing.yml", () =>
          HttpResponse.error()
        )
      )

      const yaml = dedent`
        include:
          - remote: https://example.com/ci/missing.yml

        stages:
          - test

        test:
          stage: test
          script:
            - echo "testing"
      `

      // Should not crash - missing includes are now handled gracefully
      const result = await visualizeYaml(yaml, {
        format: "ascii",
      })

      // Should still render the local job even if remote include fails
      expect(result.ascii).toContain("test")
    })

    it("should handle nested remote includes (remote file includes another remote file)", async () => {
      // Add handlers for nested includes
      server.use(
        http.get("https://example.com/ci/root.yml", () =>
          HttpResponse.text(dedent`
            include:
              - remote: https://example.com/ci/shared/base.yml

            .root-template:
              extends: .shared-base
              cache:
                paths:
                  - .npm/
          `)
        ),
        http.get("https://example.com/ci/shared/base.yml", () =>
          HttpResponse.text(dedent`
            .shared-base:
              image: alpine:latest
              tags:
                - docker
          `)
        )
      )

      const yaml = dedent`
        include:
          - remote: https://example.com/ci/root.yml

        stages:
          - build

        build:
          extends: .root-template
          stage: build
          script:
            - npm run build
      `

      const result = await visualizeYaml(yaml, {
        format: "all",
        showStages: true,
        showRemotes: true,
      })

      // Mermaid should show full nested chain
      expect(result.mermaid).toBeDefined()
      expect(result.mermaid).toContain("build")
      expect(result.mermaid).toContain(".root-template")
      expect(result.mermaid).toContain(".shared-base")
      expect(result.mermaid).toContain(":::remote")

      // ASCII should show full nested chain
      expect(result.ascii).toBeDefined()
      expect(result.ascii).toContain("build")
      expect(result.ascii).toContain(".root-template")
      expect(result.ascii).toContain(".shared-base")

      // Table should show full extends chain including nested remote templates
      expect(result.table).toBeDefined()
      expect(result.table).toContain("build ← .root-template ← .shared-base")
    })

    it("should handle multiple levels of nested remote includes", async () => {
      server.use(
        http.get("https://example.com/ci/level1.yml", () =>
          HttpResponse.text(dedent`
            include:
              - remote: https://example.com/ci/level2.yml

            .level1:
              extends: .level2
              before_script:
                - echo "level1"
          `)
        ),
        http.get("https://example.com/ci/level2.yml", () =>
          HttpResponse.text(dedent`
            include:
              - remote: https://example.com/ci/level3.yml

            .level2:
              extends: .level3
              before_script:
                - echo "level2"
          `)
        ),
        http.get("https://example.com/ci/level3.yml", () =>
          HttpResponse.text(dedent`
            .level3:
              image: alpine:latest
              before_script:
                - echo "level3"
          `)
        )
      )

      const yaml = dedent`
        include:
          - remote: https://example.com/ci/level1.yml

        stages:
          - test

        test:
          extends: .level1
          stage: test
          script:
            - npm test
      `

      const result = await visualizeYaml(yaml, {
        format: "ascii",
        showStages: true,
      })

      expect(result.ascii).toBeDefined()
      expect(result.ascii).toContain("test")
      expect(result.ascii).toContain(".level1")
      expect(result.ascii).toContain(".level2")
      expect(result.ascii).toContain(".level3")

      // Should show the full chain with proper nesting
      expect(result.ascii).toMatch(
        /test.*\n.*\.level1.*\n.*\.level2.*\n.*\.level3/su
      )
    })

    it("should handle circular remote includes gracefully", async () => {
      server.use(
        http.get("https://example.com/ci/circular-a.yml", () =>
          HttpResponse.text(dedent`
            include:
              - remote: https://example.com/ci/circular-b.yml

            .template-a:
              image: alpine:latest
          `)
        ),
        http.get("https://example.com/ci/circular-b.yml", () =>
          HttpResponse.text(dedent`
            include:
              - remote: https://example.com/ci/circular-a.yml

            .template-b:
              image: node:20
          `)
        )
      )

      const yaml = dedent`
        include:
          - remote: https://example.com/ci/circular-a.yml

        stages:
          - test

        test:
          extends: .template-a
          stage: test
          script:
            - echo "test"
      `

      // Should handle circular includes without crashing
      const result = await visualizeYaml(yaml, {
        format: "ascii",
      })

      expect(result.ascii).toBeDefined()
      expect(result.ascii).toContain("test")
      expect(result.ascii).toContain(".template-a")
    })
  })
})
