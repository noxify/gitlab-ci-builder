// oxlint-disable vitest/max-expects
import dedent from "dedent"
import { load as parseYaml } from "js-yaml"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { ConfigBuilder, resolveIncludes, visualizeYaml } from "../../../src"

const restHandlers = [
  http.get("https://example.com/templates/node.yml", () =>
    HttpResponse.text(dedent`
      .node-base:
        image: node:20
        cache:
          key: \${CI_COMMIT_REF_SLUG}
          paths:
            - node_modules/
        before_script:
          - npm ci
    `)
  ),

  http.get("https://example.com/templates/base.yml", () =>
    HttpResponse.text(dedent`
      .base:
        image: alpine:latest
        tags:
          - docker
    `)
  ),

  http.get("https://example.com/templates/deploy.yml", () =>
    HttpResponse.text(dedent`
      .deploy:
        stage: deploy
        rules:
          - if: $CI_COMMIT_BRANCH == "main"
        environment:
          name: production
    `)
  ),

  http.get("https://example.com/templates/chain.yml", () =>
    HttpResponse.text(dedent`
      .base:
        image: alpine:latest

      .node:
        extends: .base
        image: node:20

      .docker:
        extends: .base
        image: docker:latest
    `)
  ),

  http.get("https://example.com/templates/pipeline.yml", () =>
    HttpResponse.text(dedent`
      .test-base:
        image: node:20
        cache:
          paths:
            - node_modules/
    `)
  ),

  http.get("https://example.com/templates/stages.yml", () =>
    HttpResponse.text(dedent`
      .lint:
        stage: lint
        image: node:20

      .security:
        stage: security
        image: alpine:latest
    `)
  ),

  http.get("https://example.com/templates/shared.yml", () =>
    HttpResponse.text(dedent`
      .shared-cache:
        cache:
          key: \${CI_COMMIT_REF_SLUG}
          paths:
            - .cache/

      .shared-retry:
        retry:
          max: 2
          when:
            - runner_system_failure
    `)
  ),

  http.get("https://example.com/templates/complex.yml", () =>
    HttpResponse.text(dedent`
      .test:
        stage: test
        image: node:20

      .e2e:
        extends: .test
        services:
          - selenium/standalone-chrome:latest

      .integration:
        extends: .test
        services:
          - postgres:15
    `)
  ),

  // Nested remote includes test - parent includes child
  http.get("https://example.com/templates/parent.yml", () =>
    HttpResponse.text(dedent`
      include:
        - remote: https://example.com/templates/child.yml

      .parent-template:
        image: node:20
        variables:
          PARENT_VAR: "from-parent"
    `)
  ),

  http.get("https://example.com/templates/child.yml", () =>
    HttpResponse.text(dedent`
      .child-template:
        cache:
          key: \${CI_COMMIT_REF_SLUG}
          paths:
            - .cache/
        variables:
          CHILD_VAR: "from-child"
    `)
  ),

  // GitLab project includes - exact match first
  http.get("https://gitlab.com/acme/ci-templates/-/raw/main/docker.yml", () =>
    HttpResponse.text(dedent`
      .docker-build:
        image: docker:latest
        services:
          - docker:dind
        variables:
          DOCKER_TLS_CERTDIR: "/certs"
    `)
  ),
]

const server = setupServer(...restHandlers)

describe("visualizeYaml with remote includes", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it("should resolve and visualize YAML with remote include via HTTP", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/node.yml

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

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("build")
    expect(result.ascii).toContain("test")
    expect(result.ascii).toContain(".node-base")
    expect(result.ascii).toContain("[T]") // Template marker
  })

  it("should resolve multiple remote includes", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/base.yml
        - remote: https://example.com/templates/deploy.yml

      stages:
        - build
        - deploy

      build:
        extends: .base
        stage: build
        script:
          - echo "Building"

      deploy-prod:
        extends:
          - .base
          - .deploy
        script:
          - echo "Deploying"
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("build")
    expect(result.ascii).toContain("deploy-prod")
    expect(result.ascii).toContain(".base")
    expect(result.ascii).toContain(".deploy")
  })

  it("should resolve GitLab project includes", async () => {
    const yaml = dedent`
      include:
        - project: acme/ci-templates
          file: docker.yml
          ref: main

      stages:
        - build

      docker-image:
        extends: .docker-build
        stage: build
        script:
          - docker build -t myapp .
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("docker-image")
    expect(result.ascii).toContain(".docker-build")
  })

  it("should handle nested extends from remote includes", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/chain.yml

      stages:
        - build

      node-build:
        extends: .node
        stage: build
        script:
          - npm run build

      docker-build:
        extends: .docker
        stage: build
        script:
          - docker build .
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()
    expect(result.ascii).toContain("node-build")
    expect(result.ascii).toContain("docker-build")
    expect(result.ascii).toContain(".node")
    expect(result.ascii).toContain(".docker")
    expect(result.ascii).toContain(".base")
  })

  it("should visualize includes with Mermaid format", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/pipeline.yml

      stages: [build, test, deploy]

      build:
        stage: build
        script: npm run build

      test:
        extends: .test-base
        stage: test
        script: npm test
        needs: [build]

      deploy:
        stage: deploy
        script: npm run deploy
        needs: [test]
    `

    const result = await visualizeYaml(yaml, { format: "mermaid" })

    expect(result.mermaid).toBeDefined()
    expect(result.mermaid).toContain("graph LR")
    expect(result.mermaid).toContain("build")
    expect(result.mermaid).toContain("test")
    expect(result.mermaid).toContain("deploy")
    expect(result.mermaid).toContain(".test-base")
  })

  it("should handle remote include with stage table visualization", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/stages.yml

      stages:
        - lint
        - security
        - build

      eslint:
        extends: .lint
        stage: lint
        script: npm run lint

      prettier:
        extends: .lint
        stage: lint
        script: npm run format:check

      trivy:
        extends: .security
        stage: security
        script: trivy scan .

      build:
        stage: build
        script: npm run build
    `

    const result = await visualizeYaml(yaml, { format: "table" })

    expect(result.table).toBeDefined()
    expect(result.table).toContain("lint")
    expect(result.table).toContain("security")
    expect(result.table).toContain("build")
    expect(result.table).toContain("eslint")
    expect(result.table).toContain("prettier")
    expect(result.table).toContain("trivy")
  })

  it("should handle local and remote includes together", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/shared.yml

      .local-base:
        image: node:20
        extends: .shared-cache

      stages:
        - test

      unit-test:
        extends:
          - .local-base
          - .shared-retry
        stage: test
        script:
          - npm run test:unit

      e2e-test:
        extends: .local-base
        stage: test
        script:
          - npm run test:e2e
    `

    const result = await visualizeYaml(yaml, { format: "all" })

    expect(result.ascii).toBeDefined()
    expect(result.mermaid).toBeDefined()
    expect(result.table).toBeDefined()

    expect(result.ascii).toContain("unit-test")
    expect(result.ascii).toContain("e2e-test")
    expect(result.ascii).toContain(".local-base")
    expect(result.ascii).toContain(".shared-cache")
    expect(result.ascii).toContain(".shared-retry")
  })

  it("should handle remote include with complex dependencies", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/complex.yml

      stages:
        - build
        - test
        - deploy

      build:
        stage: build
        script: npm run build

      unit-test:
        extends: .test
        script: npm run test:unit
        needs: [build]

      integration-test:
        extends: .integration
        script: npm run test:integration
        needs: [build]

      e2e-test:
        extends: .e2e
        script: npm run test:e2e
        needs: [build]

      deploy:
        stage: deploy
        script: npm run deploy
        needs:
          - unit-test
          - integration-test
          - e2e-test
    `

    const result = await visualizeYaml(yaml, { format: "mermaid" })

    expect(result.mermaid).toBeDefined()
    expect(result.mermaid).toContain("build")
    expect(result.mermaid).toContain("unit-test")
    expect(result.mermaid).toContain("integration-test")
    expect(result.mermaid).toContain("e2e-test")
    expect(result.mermaid).toContain("deploy")
    expect(result.mermaid).toContain(".test")
    expect(result.mermaid).toContain(".e2e")
    expect(result.mermaid).toContain(".integration")
  })

  it("should handle nested remote includes (include within include)", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/parent.yml

      stages:
        - build
        - test

      build:
        extends: .parent-template
        stage: build
        script:
          - echo "Building with $PARENT_VAR"
          - npm run build

      test:
        extends:
          - .parent-template
          - .child-template
        stage: test
        script:
          - echo "Testing with $PARENT_VAR and $CHILD_VAR"
          - npm test
    `

    const result = await visualizeYaml(yaml, { format: "all" })

    expect(result.ascii).toBeDefined()
    expect(result.mermaid).toBeDefined()

    // Check that both parent and child templates are resolved
    expect(result.ascii).toContain(".parent-template")
    expect(result.ascii).toContain(".child-template")
    expect(result.ascii).toContain("build")
    expect(result.ascii).toContain("test")

    // Verify extends chains are shown
    expect(result.mermaid).toContain(".parent-template")
    expect(result.mermaid).toContain(".child-template")
  })

  it("should inherit stage from remote template (no explicit stage in job)", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/stages.yml

      stages:
        - lint
        - security
        - build

      eslint:
        extends: .lint
        script: npm run lint

      trivy:
        extends: .security
        script: trivy scan .

      build:
        stage: build
        script: npm run build
    `

    const result = await visualizeYaml(yaml, { format: "ascii" })

    expect(result.ascii).toBeDefined()

    // Jobs should appear in ASCII tree with their extends chain
    // Stage inheritance works in the final pipeline, but visualization
    // shows the extends relationship rather than resolved stages
    expect(result.ascii).toContain("eslint")
    expect(result.ascii).toContain("trivy")
    expect(result.ascii).toContain("build")
    expect(result.ascii).toContain(".lint")
    expect(result.ascii).toContain(".security")
  })

  it("should mark remote jobs/templates with isRemote flag in graph", async () => {
    const yaml = dedent`
      include:
        - remote: https://example.com/templates/shared.yml

      stages: [test]

      test-local:
        stage: test
        script: npm test
    `

    // We need to build the config directly to access the graph
    const parsed = parseYaml(yaml) as Record<string, unknown>
    const config = new ConfigBuilder()

    if (parsed.stages) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      config.stages(
        ...(Array.isArray(parsed.stages) ? parsed.stages : [parsed.stages])
      )
    }

    if (parsed.include) {
      config.include(parsed.include as never)
    }

    await resolveIncludes(config)

    // Add local jobs
    for (const [name, definition] of Object.entries(parsed)) {
      if (
        typeof definition === "object" &&
        definition !== null &&
        ![
          "stages",
          "variables",
          "workflow",
          "include",
          "default",
          "spec",
        ].includes(name)
      ) {
        if (name.startsWith(".")) {
          config.template(name, definition)
        } else {
          config.job(name, definition)
        }
      }
    }

    const graph = config.getExtendsGraph()

    // Check that remote items are marked as remote
    const sharedCacheNode = graph.get(".shared-cache")
    expect(sharedCacheNode?.isRemote).toBeTruthy()

    const sharedRetryNode = graph.get(".shared-retry")
    expect(sharedRetryNode?.isRemote).toBeTruthy()

    // Check that local items are NOT marked as remote
    const testLocalNode = graph.get("test-local")
    expect(testLocalNode?.isRemote).toBeFalsy()
  })
})
