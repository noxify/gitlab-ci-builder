import dedent from "dedent"
import { http, HttpResponse } from "msw"

export const handlers = [
  // Mock GitLab raw file endpoint
  http.get(
    "https://gitlab.com/api/v4/projects/:projectId/repository/files/:path/raw",
    ({ params }) => {
      const { projectId, path } = params

      // Example: Mock a template file
      if (projectId === "123" && path === "templates%2Fnode.yml") {
        return HttpResponse.text(dedent`
            .node:
            image: node:20-alpine
            cache:
                key: \${CI_COMMIT_REF_SLUG}
                paths:
                - node_modules/
            before_script:
                - npm ci
        `)
      }

      return HttpResponse.text("", { status: 404 })
    },
  ),

  // Mock direct YAML files from example.com/ci-templates
  http.get("https://example.com/ci-templates/base.yml", () => {
    return HttpResponse.text(dedent`
        .base:
        image: alpine:latest
        tags:
            - docker
        retry:
            max: 2
            when:
            - runner_system_failure
            - stuck_or_timeout_failure
    `)
  }),

  http.get("https://example.com/ci-templates/deploy.yml", () => {
    return HttpResponse.text(`
        .deploy:
        extends: .base
        stage: deploy
        rules:
            - if: $CI_COMMIT_BRANCH == "main"
        environment:
            name: production
            url: https://example.com
    `)
  }),

  // Mock templates/* URLs for remote-includes tests
  http.get("https://example.com/templates/node.yml", () => {
    return HttpResponse.text(dedent`
      .node-base:
        image: node:20
        cache:
          key: \${CI_COMMIT_REF_SLUG}
          paths:
            - node_modules/
        before_script:
          - npm ci
    `)
  }),

  // Mock ci/* URLs for visualization tests
  http.get("https://example.com/ci/base.yml", () => {
    return HttpResponse.text(dedent`
      .base-template:
        image: alpine:latest
        tags:
          - docker
        retry:
          max: 2
    `)
  }),

  http.get("https://example.com/ci/node.yml", () => {
    return HttpResponse.text(dedent`
      .node-base:
        extends: .base-template
        image: node:20
        cache:
          key: \${CI_COMMIT_REF_SLUG}
          paths:
            - node_modules/
    `)
  }),

  http.get("https://example.com/ci/deploy.yml", () => {
    return HttpResponse.text(dedent`
      .deploy-job:
        stage: deploy
        rules:
          - if: $CI_COMMIT_BRANCH == "main"
        environment:
          name: production
    `)
  }),

  http.get("https://example.com/ci/team-a.yml", () => {
    return HttpResponse.text(dedent`
      .team-a-template:
        image: node:20
        tags:
          - team-a
    `)
  }),

  http.get("https://example.com/ci/missing.yml", () => {
    return HttpResponse.text("", { status: 404 })
  }),

  http.get("https://example.com/ci/root.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/shared/base.yml

      .root-template:
        image: alpine:latest
    `)
  }),

  http.get("https://example.com/ci/shared/base.yml", () => {
    return HttpResponse.text(dedent`
      .shared-base:
        retry:
          max: 2
    `)
  }),

  http.get("https://example.com/ci/level1.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/level2.yml

      .level1:
        image: alpine:latest
    `)
  }),

  http.get("https://example.com/ci/level2.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/level3.yml

      .level2:
        tags:
          - docker
    `)
  }),

  http.get("https://example.com/ci/level3.yml", () => {
    return HttpResponse.text(dedent`
      .level3:
        retry:
          max: 3
    `)
  }),

  http.get("https://example.com/ci/circular-a.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/circular-b.yml

      .circular-a:
        image: alpine:latest
    `)
  }),

  http.get("https://example.com/ci/circular-b.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/circular-a.yml

      .circular-b:
        tags:
          - docker
    `)
  }),

  http.get("https://example.com/templates/base.yml", () => {
    return HttpResponse.text(dedent`
      .base:
        image: alpine:latest
        tags:
          - docker
    `)
  }),

  http.get("https://example.com/templates/deploy.yml", () => {
    return HttpResponse.text(dedent`
      .deploy:
        stage: deploy
        rules:
          - if: $CI_COMMIT_BRANCH == "main"
        environment:
          name: production
    `)
  }),

  http.get("https://example.com/templates/chain.yml", () => {
    return HttpResponse.text(dedent`
      .base:
        image: alpine:latest

      .node:
        extends: .base
        image: node:20

      .docker:
        extends: .base
        image: docker:latest
    `)
  }),

  http.get("https://example.com/templates/pipeline.yml", () => {
    return HttpResponse.text(dedent`
      .test-base:
        image: node:20
        cache:
          paths:
            - node_modules/
    `)
  }),

  http.get("https://example.com/templates/stages.yml", () => {
    return HttpResponse.text(dedent`
      .lint:
        stage: lint
        image: node:20

      .security:
        stage: security
        image: alpine:latest
    `)
  }),

  http.get("https://example.com/templates/shared.yml", () => {
    return HttpResponse.text(dedent`
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
  }),

  http.get("https://example.com/templates/complex.yml", () => {
    return HttpResponse.text(dedent`
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
  }),

  // Mock GitLab project includes - exact match
  http.get("https://gitlab.com/acme/ci-templates/-/raw/main/docker.yml", () => {
    return HttpResponse.text(dedent`
      .docker-build:
        image: docker:latest
        services:
          - docker:dind
        variables:
          DOCKER_TLS_CERTDIR: "/certs"
    `)
  }),
]
