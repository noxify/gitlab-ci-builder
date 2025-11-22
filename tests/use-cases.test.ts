import { describe, expect, it } from "vitest"

import { ConfigBuilder } from "../src"

describe("Real-World Use Cases", () => {
  describe("Semantic Release Pipeline", () => {
    // Based on: https://docs.gitlab.com/ci/examples/semantic-release/#configure-the-pipeline
    it("should build a semantic release pipeline", () => {
      const config = new ConfigBuilder()

      config
        .stages("build", "test", "release")
        .variable("NPM_TOKEN", "${CI_JOB_TOKEN}")
        .job("build", {
          stage: "build",
          image: "node:20-alpine",
          script: ["npm ci --cache .npm --prefer-offline", "npm run build"],
          cache: {
            key: {
              files: ["package-lock.json"],
            },
            paths: [".npm/"],
          },
          artifacts: {
            paths: ["dist/"],
          },
        })
        .job("test", {
          stage: "test",
          image: "node:20-alpine",
          script: ["npm ci --cache .npm --prefer-offline", "npm test"],
          cache: {
            key: {
              files: ["package-lock.json"],
            },
            paths: [".npm/"],
            policy: "pull",
          },
        })
        .job("release", {
          stage: "release",
          image: "node:20-alpine",
          script: ["npm ci --cache .npm --prefer-offline", "npx semantic-release"],
          cache: {
            key: {
              files: ["package-lock.json"],
            },
            paths: [".npm/"],
            policy: "pull",
          },
          rules: [
            {
              if: '$CI_COMMIT_BRANCH == "main"',
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build", "test", "release"])
      expect(result.jobs?.build?.image).toBe("node:20-alpine")
      const testCache = result.jobs?.test?.cache
      if (testCache && !Array.isArray(testCache)) {
        expect(testCache.policy).toBe("pull")
      }
      expect(result.jobs?.release?.rules).toHaveLength(1)
    })
  })

  describe("Docker Build and Deploy Pipeline", () => {
    // Based on common Docker patterns
    it("should build a docker-based deployment pipeline", () => {
      const config = new ConfigBuilder()

      config
        .stages("build", "test", "deploy")
        .variables({
          DOCKER_DRIVER: "overlay2",
          DOCKER_TLS_CERTDIR: "/certs",
        })
        .template(".docker-base", {
          image: "docker:latest",
          services: ["docker:dind"],
          before_script: [
            "docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY",
          ],
        })
        .extends(".docker-base", "build-image", {
          stage: "build",
          script: [
            "docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG .",
            "docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG",
          ],
        })
        .extends(".docker-base", "deploy-staging", {
          stage: "deploy",
          script: [
            "docker pull $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG",
            "docker stop my-app || true",
            "docker rm my-app || true",
            "docker run -d --name my-app -p 80:80 $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG",
          ],
          environment: {
            name: "staging",
            url: "https://staging.example.com",
          },
          rules: [
            {
              if: '$CI_COMMIT_BRANCH == "develop"',
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.stages).toEqual(["build", "test", "deploy"])
      expect(result.variables?.DOCKER_DRIVER).toBe("overlay2")
      expect(result.jobs?.["build-image"]?.services).toContain("docker:dind")
      const stagingEnv = result.jobs?.["deploy-staging"]?.environment
      if (stagingEnv && typeof stagingEnv !== "string") {
        expect(stagingEnv.name).toBe("staging")
      }
    })
  })

  describe("Multi-Environment Deployment", () => {
    // Based on real-world multi-env patterns
    it("should support multiple deployment environments", () => {
      const config = new ConfigBuilder()

      config
        .stages("build", "test", "deploy-staging", "deploy-production")
        .template(".deploy-template", {
          script: [
            "apt-get update -qq && apt-get install -y -qq lftp",
            'lftp -c "set ftp:ssl-allow no; open -u $FTP_USERNAME,$FTP_PASSWORD $FTP_HOST; mirror -Rev ./dist /www --ignore-time --parallel=10"',
          ],
        })
        .job("build", {
          stage: "build",
          image: "node:20",
          script: ["npm ci", "npm run build"],
          artifacts: {
            paths: ["dist/"],
            expire_in: "1 week",
          },
        })
        .extends(".deploy-template", "deploy-staging", {
          stage: "deploy-staging",
          environment: {
            name: "staging",
            url: "https://staging.example.com",
          },
          rules: [
            {
              if: '$CI_COMMIT_BRANCH == "develop"',
            },
          ],
        })
        .extends(".deploy-template", "deploy-production", {
          stage: "deploy-production",
          environment: {
            name: "production",
            url: "https://example.com",
          },
          rules: [
            {
              if: '$CI_COMMIT_BRANCH == "main"',
              when: "manual",
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.stages).toHaveLength(4)
      const stagingEnv = result.jobs?.["deploy-staging"]?.environment
      if (stagingEnv && typeof stagingEnv !== "string") {
        expect(stagingEnv.name).toBe("staging")
      }
      const prodEnv = result.jobs?.["deploy-production"]?.environment
      if (prodEnv && typeof prodEnv !== "string") {
        expect(prodEnv.name).toBe("production")
      }
      expect(result.jobs?.["deploy-production"]?.rules?.[0]?.when).toBe("manual")
    })
  })

  describe("Monorepo with Multiple Services", () => {
    // Based on monorepo patterns
    it("should handle monorepo with multiple services", () => {
      const config = new ConfigBuilder()

      config
        .stages("lint", "test", "build", "deploy")
        .template(".service-base", {
          image: "node:20",
          before_script: ["npm ci"],
        })
        .extends(".service-base", "lint-frontend", {
          stage: "lint",
          script: ["cd packages/frontend", "npm run lint"],
          rules: [
            {
              changes: ["packages/frontend/**/*"],
            },
          ],
        })
        .extends(".service-base", "test-frontend", {
          stage: "test",
          script: ["cd packages/frontend", "npm run test"],
          rules: [
            {
              changes: ["packages/frontend/**/*"],
            },
          ],
        })
        .extends(".service-base", "lint-backend", {
          stage: "lint",
          script: ["cd packages/backend", "npm run lint"],
          rules: [
            {
              changes: ["packages/backend/**/*"],
            },
          ],
        })
        .extends(".service-base", "test-backend", {
          stage: "test",
          script: ["cd packages/backend", "npm run test"],
          coverage: "/Coverage: \\d+\\.\\d+/",
          rules: [
            {
              changes: ["packages/backend/**/*"],
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.stages).toEqual(["lint", "test", "build", "deploy"])
      expect(result.jobs?.["lint-frontend"]?.rules?.[0]).toHaveProperty("changes")
      expect(result.jobs?.["test-backend"]?.coverage).toBeDefined()
    })
  })

  describe("Complex Matrix Pipeline", () => {
    // Testing parallel jobs and matrix builds
    it("should support parallel matrix builds", () => {
      const config = new ConfigBuilder()

      config
        .stages("test", "deploy")
        .job("test-node", {
          stage: "test",
          image: "node:$NODE_VERSION",
          parallel: {
            matrix: [{ NODE_VERSION: "18" }, { NODE_VERSION: "20" }, { NODE_VERSION: "22" }],
          },
          script: ["node --version", "npm ci", "npm test"],
        })
        .job("test-browsers", {
          stage: "test",
          image: "cypress/browsers:latest",
          parallel: 3,
          script: ["npm ci", "npm run test:e2e"],
        })

      const result = config.getPlainObject()

      expect(result.jobs?.["test-node"]?.parallel).toHaveProperty("matrix")
      expect(result.jobs?.["test-browsers"]?.parallel).toBe(3)
    })
  })

  describe("Workflow with Complex Rules", () => {
    // Based on advanced workflow patterns
    it("should support complex workflow rules", () => {
      const config = new ConfigBuilder()

      config
        .workflow({
          rules: [
            {
              if: '$CI_PIPELINE_SOURCE == "merge_request_event"',
            },
            {
              if: '$CI_COMMIT_BRANCH == "main"',
            },
            {
              if: "$CI_COMMIT_TAG",
            },
          ],
        })
        .stages("build", "test", "deploy")
        .job("build", {
          stage: "build",
          script: ["echo build"],
        })
        .job("deploy", {
          stage: "deploy",
          script: ["echo deploy"],
          rules: [
            {
              if: "$CI_COMMIT_TAG",
              variables: {
                ENVIRONMENT: "production",
              },
            },
            {
              if: '$CI_COMMIT_BRANCH == "main"',
              variables: {
                ENVIRONMENT: "staging",
              },
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.workflow?.rules).toHaveLength(3)
      expect(result.jobs?.deploy?.rules?.[0]?.variables?.ENVIRONMENT).toBe("production")
    })
  })

  describe("Pipeline with Includes and Triggers", () => {
    // Testing advanced features
    it("should support includes and downstream triggers", () => {
      const config = new ConfigBuilder()

      config
        .include([
          { local: ".gitlab/ci/common.yml" },
          { template: "Security/SAST.gitlab-ci.yml" },
          {
            remote: "https://gitlab.com/example/ci-templates/-/raw/main/template.yml",
          },
        ])
        .stages("build", "test", "trigger")
        .job("build", {
          stage: "build",
          script: ["echo build"],
        })
        .job("trigger-downstream", {
          stage: "trigger",
          trigger: {
            project: "example/downstream-project",
            strategy: "depend",
          },
          rules: [
            {
              if: '$CI_COMMIT_BRANCH == "main"',
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.include).toHaveLength(3)
      expect(result.include?.[0]).toHaveProperty("local")
      expect(result.include?.[1]).toHaveProperty("template")
      expect(result.include?.[2]).toHaveProperty("remote")
      expect(result.jobs?.["trigger-downstream"]?.trigger).toBeDefined()
    })
  })

  describe("Pipeline with Needs and DAG", () => {
    // Testing dependency graphs
    it("should support needs for DAG pipelines", () => {
      const config = new ConfigBuilder()

      config
        .stages("build", "test", "deploy")
        .job("build-frontend", {
          stage: "build",
          script: ["npm run build:frontend"],
          artifacts: {
            paths: ["dist/frontend/"],
          },
        })
        .job("build-backend", {
          stage: "build",
          script: ["npm run build:backend"],
          artifacts: {
            paths: ["dist/backend/"],
          },
        })
        .job("test-integration", {
          stage: "test",
          script: ["npm run test:integration"],
          needs: ["build-frontend", "build-backend"],
        })
        .job("deploy", {
          stage: "deploy",
          script: ["echo deploy"],
          needs: [
            {
              job: "test-integration",
              artifacts: false,
            },
          ],
        })

      const result = config.getPlainObject()

      expect(result.jobs?.["test-integration"]?.needs).toEqual(["build-frontend", "build-backend"])
      const deployNeeds = result.jobs?.deploy?.needs
      if (deployNeeds && Array.isArray(deployNeeds) && deployNeeds.length > 0) {
        expect(deployNeeds[0]).toMatchObject({
          job: "test-integration",
          artifacts: false,
        })
      }
    })
  })

  describe("Pipeline with Default Configuration", () => {
    // Testing default settings
    it("should apply default configuration to all jobs", () => {
      const config = new ConfigBuilder()

      config
        .defaults({
          image: "node:20-alpine",
          tags: ["docker", "linux"],
          retry: { max: 2, when: ["runner_system_failure", "stuck_or_timeout_failure"] },
          interruptible: true,
        })
        .stages("test", "build")
        .job("test", {
          script: ["npm test"],
        })
        .job("build", {
          script: ["npm run build"],
          image: "node:22", // Override default
        })

      const result = config.getPlainObject()

      expect(result.default?.image).toBe("node:20-alpine")
      expect(result.default?.tags).toEqual(["docker", "linux"])
      expect(result.default?.retry).toMatchObject({ max: 2 })
      expect(result.default?.interruptible).toBe(true)
      expect(result.jobs?.build?.image).toBe("node:22")
    })
  })
})
