import dedent from "dedent"
import { vol } from "memfs"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { JobDefinitionNormalized } from "../../src/schema"
import {
  buildExtendsGraph,
  extractChildPipelines,
  generateAsciiTree,
  generateMermaidDiagram,
} from "../../src"

describe("Child Pipeline Visualization", () => {
  const testDir = "/test"

  beforeEach(() => {
    vol.reset()
    vol.mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    vol.reset()
  })

  describe("extractChildPipelines", () => {
    it("should extract child pipeline from local include", () => {
      const childYaml = dedent`
        stages:
          - test
          - deploy

        test:unit:
          stage: test
          script: npm test

        deploy:prod:
          stage: deploy
          script: ./deploy.sh
      `

      const childPath = `${testDir}/child-pipeline.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          stage: "trigger",
          trigger: {
            include: { local: "child-pipeline.yml" },
            strategy: "depend",
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(1)
      expect(childPipelines[0]?.parentJob).toBe("trigger:child")
      expect(childPipelines[0]?.source).toBe("child-pipeline.yml")
      expect(childPipelines[0]?.graph.size).toBe(2)
      expect(childPipelines[0]?.graph.has("test:unit")).toBe(true)
      expect(childPipelines[0]?.graph.has("deploy:prod")).toBe(true)
    })

    it("should handle artifact includes gracefully", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "generate-config": {
          stage: "prepare",
          script: ["./generate.sh"],
        },
        "trigger:child": {
          stage: "trigger",
          trigger: {
            include: {
              artifact: "generated-config.yml",
              job: "generate-config",
            },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(1)
      expect(childPipelines[0]?.parentJob).toBe("trigger:child")
      expect(childPipelines[0]?.source).toBe("artifact:generated-config.yml")
      expect(childPipelines[0]?.graph.size).toBe(0)
    })

    it("should not extract downstream pipelines (project trigger)", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:downstream": {
          stage: "trigger",
          trigger: {
            project: "my-group/my-project",
            strategy: "depend",
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(0)
    })

    it("should extract child pipeline with templates", () => {
      const childYaml = dedent`
        .base:
          image: node:20

        test:
          extends: .base
          stage: test
          script: npm test
      `

      const childPath = `${testDir}/child-with-template.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "child-with-template.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(1)
      expect(childPipelines[0]?.graph.size).toBe(2)
      expect(childPipelines[0]?.graph.has(".base")).toBe(true)
      expect(childPipelines[0]?.graph.has("test")).toBe(true)

      const testNode = childPipelines[0]?.graph.get("test")
      expect(testNode?.extends).toEqual([".base"])
    })
  })

  describe("Mermaid Diagram with Child Pipelines", () => {
    it("should generate mermaid diagram with child pipeline", () => {
      const childYaml = dedent`
        stages:
          - test

        test:unit:
          stage: test
          script: npm test
      `

      const childPath = `${testDir}/child.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          stage: "build",
          script: ["npm run build"],
        },
        "trigger:child": {
          stage: "trigger",
          trigger: {
            include: { local: "child.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs, stages: ["build", "trigger"] }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showChildPipelines: true, basePath: testDir },
      })

      expect(mermaid).toContain("graph LR")
      expect(mermaid).toContain("build")
      expect(mermaid).toContain("trigger:child")
      expect(mermaid).toContain("Child Pipeline: child.yml")
      expect(mermaid).toContain("test:unit")
      expect(mermaid).toContain("triggers")
      expect(mermaid).toContain("classDef childPipeline")
    })

    it("should not show child pipelines when option is disabled", () => {
      const childYaml = dedent`
        test:unit:
          script: npm test
      `

      const childPath = `${testDir}/child.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "child.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showChildPipelines: false },
      })

      expect(mermaid).not.toContain("Child Pipeline")
      expect(mermaid).not.toContain("test:unit")
    })

    it("should show extends relationships within child pipeline", () => {
      const childYaml = dedent`
        .base:
          image: node:20

        test:
          extends: .base
          script: npm test
      `

      const childPath = `${testDir}/child.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "child.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const mermaid = generateMermaidDiagram({
        graph,
        resolvedConfig,
        options: { showChildPipelines: true, basePath: testDir },
      })

      expect(mermaid).toContain(".base")
      expect(mermaid).toContain("test")
      // Should have extends arrow within child pipeline
      expect(mermaid).toMatch(/-->/)
    })
  })

  describe("ASCII Tree with Child Pipelines", () => {
    it("should generate ASCII tree with child pipeline", () => {
      const childYaml = dedent`
        test:unit:
          script: npm test

        deploy:
          script: ./deploy.sh
      `

      const childPath = `${testDir}/child.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        build: {
          script: ["npm run build"],
        },
        "trigger:child": {
          trigger: {
            include: { local: "child.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({
        graph,
        resolvedConfig,
        options: { showChildPipelines: true, basePath: testDir },
      })

      expect(ascii).toContain("build")
      expect(ascii).toContain("trigger:child")
      expect(ascii).toContain("🔀 Child Pipeline: child.yml")
      expect(ascii).toContain("test:unit")
      expect(ascii).toContain("deploy")
    })

    it("should show child pipeline with stage information", () => {
      const childYaml = dedent`
        stages:
          - test
          - deploy

        test:unit:
          stage: test
          script: npm test

        deploy:prod:
          stage: deploy
          script: ./deploy.sh
      `

      const childPath = `${testDir}/child.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "child.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({
        graph,
        resolvedConfig,
        options: { showChildPipelines: true, showStages: true, basePath: testDir },
      })

      expect(ascii).toContain("test:unit (test)")
      expect(ascii).toContain("deploy:prod (deploy)")
    })

    it("should handle child pipeline with templates", () => {
      const childYaml = dedent`
        .deploy-template:
          script: ./deploy.sh

        deploy:prod:
          extends: .deploy-template
          environment: production
      `

      const childPath = `${testDir}/child.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "child.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const resolvedConfig = { jobs }
      const ascii = generateAsciiTree({
        graph,
        resolvedConfig,
        options: { showChildPipelines: true, basePath: testDir },
      })

      expect(ascii).toContain(".deploy-template [T]")
      expect(ascii).toContain("deploy:prod")
    })
  })

  describe("Edge Cases", () => {
    it("should handle missing child pipeline file gracefully", () => {
      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "non-existent.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(0)
    })

    it("should handle multiple child pipelines", () => {
      const child1Yaml = "test1:\n  script: test1"
      const child2Yaml = "test2:\n  script: test2"

      vol.writeFileSync(`${testDir}/child1.yml`, child1Yaml)
      vol.writeFileSync(`${testDir}/child2.yml`, child2Yaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child1": {
          trigger: {
            include: { local: "child1.yml" },
          },
        },
        "trigger:child2": {
          trigger: {
            include: { local: "child2.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(2)
      expect(childPipelines[0]?.parentJob).toBe("trigger:child1")
      expect(childPipelines[1]?.parentJob).toBe("trigger:child2")
    })

    it("should handle empty child pipeline", () => {
      const childYaml = "# Empty pipeline\n"

      const childPath = `${testDir}/empty.yml`
      vol.writeFileSync(childPath, childYaml)

      const jobs: Record<string, JobDefinitionNormalized> = {
        "trigger:child": {
          trigger: {
            include: { local: "empty.yml" },
          },
        },
      }

      const graph = buildExtendsGraph(jobs, {})
      const childPipelines = extractChildPipelines(graph, testDir)

      expect(childPipelines).toHaveLength(1)
      expect(childPipelines[0]?.graph.size).toBe(0)
    })
  })
})
