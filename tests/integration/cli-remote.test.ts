// oxlint-disable vitest/max-expects
import dedent from "dedent"
import { describe, expect, it } from "vitest"

import { visualizeYaml } from "../../src"

describe("visualizeYaml function", () => {
  it("should generate ASCII visualization from simple YAML", async () => {
    const yaml = dedent`
      stages:
        - build
        - test

      .base:
        image: node:20

      build:
        extends: .base
        stage: build
        script:
          - npm run build

      test:
        extends: .base
        stage: test
        script:
          - npm test
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("build")
    expect(result.ascii).toContain("test")
    expect(result.ascii).toContain(".base")
    expect(result.ascii).toContain("[T]") // Template marker
    expect(result.mermaid).toBeUndefined()
    expect(result.table).toBeUndefined()
  })

  it("should generate Mermaid diagram from YAML", async () => {
    const yaml = dedent`
      stages: [build, test, deploy]

      build:
        stage: build
        script: echo "building"

      test:
        stage: test
        script: echo "testing"
        needs: [build]

      deploy:
        stage: deploy
        script: echo "deploying"
        needs: [test]
    `

    const result = await visualizeYaml(yaml, { format: "mermaid" })

    expect(result.mermaid).toBeDefined()
    expect(result.mermaid).toContain("graph LR")
    expect(result.mermaid).toContain("build")
    expect(result.mermaid).toContain("test")
    expect(result.mermaid).toContain("deploy")
    expect(result.ascii).toBeUndefined()
    expect(result.table).toBeUndefined()
  })

  it("should generate stage table from YAML", async () => {
    const yaml = dedent`
      stages:
        - build
        - test

      build:
        stage: build
        script: npm run build

      unit-test:
        stage: test
        script: npm run test:unit

      integration-test:
        stage: test
        script: npm run test:integration
    `

    const result = await visualizeYaml(yaml, { format: "table" })

    expect(result.table).toBeDefined()
    expect(result.table).toContain("build")
    expect(result.table).toContain("unit-test")
    expect(result.table).toContain("integration-test")
    expect(result.mermaid).toBeUndefined()
    expect(result.ascii).toBeUndefined()
  })

  it("should generate all formats when format is 'all'", async () => {
    const yaml = dedent`
      .base:
        image: alpine:latest

      job1:
        extends: .base
        script: echo "test"
    `

    const result = await visualizeYaml(yaml, { format: "all" })

    expect(result.mermaid).toBeDefined()
    expect(result.ascii).toBeDefined()
    expect(result.table).toBeDefined()
  })

  it("should handle complex extends chains", async () => {
    const yaml = dedent`
      .base:
        image: alpine:latest

      .node:
        extends: .base
        image: node:20

      .docker:
        extends: .base
        image: docker:latest

      build:
        extends: .node
        stage: build
        script: npm run build

      docker-build:
        extends: .docker
        stage: build
        script: docker build .
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("build")
    expect(result.ascii).toContain("docker-build")
    expect(result.ascii).toContain(".node")
    expect(result.ascii).toContain(".docker")
    expect(result.ascii).toContain(".base")
  })

  it("should handle YAML with variables and workflow", async () => {
    const yaml = dedent`
      variables:
        NODE_VERSION: "20"
        DOCKER_IMAGE: "node:$NODE_VERSION"

      workflow:
        rules:
          - if: $CI_COMMIT_BRANCH == "main"

      stages:
        - build

      build:
        stage: build
        script: npm run build
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("build")
  })

  it("should handle empty or minimal YAML", async () => {
    const yaml = dedent`
      test:
        script: echo "hello"
    `

    const result = await visualizeYaml(yaml, { format: "all" })

    expect(result.mermaid).toBeDefined()
    expect(result.ascii).toBeDefined()
    expect(result.table).toBeDefined()
  })
})
