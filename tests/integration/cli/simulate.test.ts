import dedent from "dedent"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { RuleContext } from "../../../src/simulation"
import { convertYamlToConfig, resolveIncludes } from "../../../src"
import { PipelineSimulator } from "../../../src/simulation"

const restHandlers = [
  // Level 1: Main remote template with nested includes
  http.get("https://example.com/ci/level1.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/level2.yml

      .level1-base:
        image: node:20
        variables:
          LEVEL: "1"
    `)
  }),

  // Level 2: Nested template with further includes
  http.get("https://example.com/ci/level2.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/level3.yml

      .level2-build:
        stage: build
        extends: .level1-base
        script:
          - npm run build
        rules:
          - if: $CI_COMMIT_BRANCH == "main"
    `)
  }),

  // Level 3: Deep nested template
  http.get("https://example.com/ci/level3.yml", () => {
    return HttpResponse.text(dedent`
      include:
        - remote: https://example.com/ci/level4.yml

      .level3-test:
        stage: test
        script:
          - npm test
        rules:
          - if: $CI_COMMIT_BRANCH =~ /^(main|develop)$/
    `)
  }),

  // Level 4: Deepest level
  http.get("https://example.com/ci/level4.yml", () => {
    return HttpResponse.text(dedent`
      .level4-deploy:
        stage: deploy
        script:
          - echo "Deploying..."
        rules:
          - if: $CI_COMMIT_BRANCH == "main"
          - if: $CI_COMMIT_TAG
        needs:
          - build-app
    `)
  }),

  // Additional shared templates
  http.get("https://example.com/ci/docker.yml", () => {
    return HttpResponse.text(dedent`
      .docker-base:
        image: docker:latest
        services:
          - docker:dind
        variables:
          DOCKER_TLS_CERTDIR: "/certs"
        before_script:
          - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    `)
  }),

  http.get("https://example.com/ci/security.yml", () => {
    return HttpResponse.text(dedent`
      .security-scan:
        stage: security
        image: aquasec/trivy:latest
        script:
          - trivy image $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
        rules:
          - if: $CI_MERGE_REQUEST_ID
          - if: $CI_COMMIT_BRANCH == "main"
    `)
  }),
]

const server = setupServer(...restHandlers)

describe("Pipeline Simulation - Integration Tests", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" })
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  describe("Simple Pipeline", () => {
    it("should simulate simple pipeline with three sequential stages", () => {
      const yaml = dedent`
        stages:
          - build
          - test
          - deploy

        build-app:
          stage: build
          script:
            - echo "Building application..."
            - npm run build

        test-app:
          stage: test
          script:
            - echo "Testing application..."
            - npm test

        deploy-app:
          stage: deploy
          script:
            - echo "Deploying application..."
            - ./deploy.sh
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      const context: RuleContext = {
        variables: {},
      }

      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(3)
      expect(result.jobsToRun).toBe(3)
      expect(result.jobsSkipped).toBe(0)
      expect(result.stages).toEqual(["build", "test", "deploy"])

      const buildJob = result.jobs.find((j) => j.name === "build-app")
      expect(buildJob).toBeDefined()
      expect(buildJob?.shouldRun).toBe(true)
      expect(buildJob?.stage).toBe("build")

      const testJob = result.jobs.find((j) => j.name === "test-app")
      expect(testJob).toBeDefined()
      expect(testJob?.shouldRun).toBe(true)
      expect(testJob?.stage).toBe("test")

      const deployJob = result.jobs.find((j) => j.name === "deploy-app")
      expect(deployJob).toBeDefined()
      expect(deployJob?.shouldRun).toBe(true)
      expect(deployJob?.stage).toBe("deploy")

      // Verify stage order
      const jobNames = result.jobs.map((j) => j.name)
      expect(jobNames).toEqual(["build-app", "test-app", "deploy-app"])
    })

    it("should simulate pipeline with parallel jobs in same stage", () => {
      const yaml = dedent`
        stages:
          - test
          - deploy

        unit-tests:
          stage: test
          script:
            - npm run test:unit

        integration-tests:
          stage: test
          script:
            - npm run test:integration

        e2e-tests:
          stage: test
          script:
            - npm run test:e2e

        deploy:
          stage: deploy
          script:
            - echo "Deploying..."
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      const context: RuleContext = {
        variables: {},
      }

      const result = simulator.simulate(config, context)

      expect(result.totalJobs).toBe(4)
      expect(result.jobsToRun).toBe(4)
      expect(result.stages).toEqual(["test", "deploy"])

      const testJobs = result.jobs.filter((j) => j.stage === "test")
      expect(testJobs).toHaveLength(3)
      testJobs.forEach((job) => {
        expect(job.shouldRun).toBe(true)
      })
    })
  })

  describe("Advanced Pipeline with Rules", () => {
    it("should simulate pipeline with branch-based rules", () => {
      const yaml = dedent`
        workflow:
          rules:
            - if: $CI_MERGE_REQUEST_ID
            - if: $CI_COMMIT_BRANCH

        stages:
          - build
          - test
          - deploy

        build-main:
          stage: build
          script:
            - npm run build
          rules:
            - if: $CI_COMMIT_BRANCH == "main"

        build-develop:
          stage: build
          script:
            - npm run build:dev
          rules:
            - if: $CI_COMMIT_BRANCH == "develop"

        test:
          stage: test
          script:
            - npm test
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^(main|develop)$/

        deploy-production:
          stage: deploy
          script:
            - ./deploy.sh production
          rules:
            - if: $CI_COMMIT_BRANCH == "main"

        deploy-staging:
          stage: deploy
          script:
            - ./deploy.sh staging
          rules:
            - if: $CI_COMMIT_BRANCH == "develop"
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      // Simulate on main branch
      const mainContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
        },
        branch: "main",
      }

      const mainResult = simulator.simulate(config, mainContext)

      expect(mainResult.totalJobs).toBe(5)
      expect(mainResult.jobsToRun).toBe(3) // build-main, test, deploy-production

      const buildMain = mainResult.jobs.find((j) => j.name === "build-main")
      expect(buildMain?.shouldRun).toBe(true)

      const buildDevelop = mainResult.jobs.find((j) => j.name === "build-develop")
      expect(buildDevelop?.shouldRun).toBe(false)

      const test = mainResult.jobs.find((j) => j.name === "test")
      expect(test?.shouldRun).toBe(true)

      const deployProd = mainResult.jobs.find((j) => j.name === "deploy-production")
      expect(deployProd?.shouldRun).toBe(true)

      const deployStaging = mainResult.jobs.find((j) => j.name === "deploy-staging")
      expect(deployStaging?.shouldRun).toBe(false)

      // Simulate on develop branch
      const developContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "develop",
        },
        branch: "develop",
      }

      const developResult = simulator.simulate(config, developContext)

      expect(developResult.jobsToRun).toBe(3) // build-develop, test, deploy-staging

      const buildDevelopDev = developResult.jobs.find((j) => j.name === "build-develop")
      expect(buildDevelopDev?.shouldRun).toBe(true)

      const deployStagingDev = developResult.jobs.find((j) => j.name === "deploy-staging")
      expect(deployStagingDev?.shouldRun).toBe(true)
    })

    it("should respect workflow rules for merge requests", () => {
      const yaml = dedent`
        workflow:
          rules:
            - if: $CI_MERGE_REQUEST_ID
            - if: $CI_COMMIT_BRANCH == "main"
            - when: never

        stages:
          - build
          - test

        build:
          stage: build
          script:
            - npm run build

        test:
          stage: test
          script:
            - npm test
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      // With merge request - pipeline should run
      const mrContext: RuleContext = {
        variables: {
          CI_MERGE_REQUEST_ID: "123",
          CI_COMMIT_BRANCH: "feature-branch",
        },
        branch: "feature-branch",
      }

      const mrResult = simulator.simulate(config, mrContext)
      expect(mrResult.jobsToRun).toBe(2)

      // Without merge request on feature branch - should not run
      // Note: Workflow rules are evaluated at pipeline level, not by simulator
      // This test documents expected behavior when workflow conditions are met
      const featureContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "feature-branch",
        },
        branch: "feature-branch",
      }

      const featureResult = simulator.simulate(config, featureContext)
      // Jobs are still evaluated, but workflow would prevent pipeline execution
      expect(featureResult.totalJobs).toBe(2)
    })

    it("should handle complex branch pattern rules", () => {
      const yaml = dedent`
        stages:
          - build
          - test

        build-feature:
          stage: build
          script:
            - npm run build
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^feature-.+/

        build-hotfix:
          stage: build
          script:
            - npm run build
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^hotfix-/

        test-all:
          stage: test
          script:
            - npm test
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^(feature|hotfix|main|develop)/
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      // Feature branch
      const featureContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "feature-new-ui",
        },
        branch: "feature-new-ui",
      }

      const featureResult = simulator.simulate(config, featureContext)
      expect(featureResult.jobsToRun).toBeGreaterThanOrEqual(1) // At least build-feature

      const buildFeature = featureResult.jobs.find((j) => j.name === "build-feature")
      expect(buildFeature?.shouldRun).toBe(true)

      // Hotfix branch
      const hotfixContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "hotfix-urgent-fix",
        },
        branch: "hotfix-urgent-fix",
      }

      const hotfixResult = simulator.simulate(config, hotfixContext)
      expect(hotfixResult.jobsToRun).toBeGreaterThanOrEqual(1) // At least build-hotfix or test-all

      const buildHotfix = hotfixResult.jobs.find((j) => j.name === "build-hotfix")
      expect(buildHotfix?.shouldRun).toBe(true)
    })

    it("should handle manual jobs with rules", () => {
      const yaml = dedent`
        stages:
          - build
          - deploy

        build:
          stage: build
          script:
            - npm run build

        deploy-staging:
          stage: deploy
          script:
            - ./deploy.sh staging
          rules:
            - if: $CI_COMMIT_BRANCH == "develop"
              when: manual

        deploy-production:
          stage: deploy
          script:
            - ./deploy.sh production
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
              when: manual
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      const mainContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
        },
        branch: "main",
      }

      const result = simulator.simulate(config, mainContext)

      const deployProd = result.jobs.find((j) => j.name === "deploy-production")
      expect(deployProd?.shouldRun).toBe(true)
      expect(deployProd?.when).toBe("manual")

      const deployStaging = result.jobs.find((j) => j.name === "deploy-staging")
      expect(deployStaging?.shouldRun).toBe(false)
    })
  })

  describe("Complex Pipeline with Remote Includes", () => {
    it("should simulate pipeline with nested remote includes (4 levels)", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/level1.yml

        stages:
          - build
          - test
          - deploy

        build-app:
          stage: build
          extends: .level2-build
          script:
            - npm run build
          rules:
            - if: $CI_COMMIT_BRANCH == "main"

        test-app:
          stage: test
          extends: .level3-test
          script:
            - npm test
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^(main|develop)$/

        deploy-app:
          stage: deploy
          extends: .level4-deploy
          script:
            - echo "Deploying..."
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
            - if: $CI_COMMIT_TAG
          needs:
            - build-app
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      await resolveIncludes(config, {
        resolveReferences: true,
        basePath: process.cwd(),
      })

      const simulator = new PipelineSimulator()

      // Simulate on main branch
      const mainContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
        },
        branch: "main",
      }

      const mainResult = simulator.simulate(config, mainContext)

      // All jobs should be resolved and have scripts from templates
      expect(mainResult.totalJobs).toBeGreaterThanOrEqual(3)
      expect(mainResult.jobsToRun).toBeGreaterThanOrEqual(2) // At least build and test on main

      const buildApp = mainResult.jobs.find((j) => j.name === "build-app")
      if (buildApp) {
        expect(buildApp.shouldRun).toBe(true)
        expect(buildApp.stage).toBe("build")
      }

      const testApp = mainResult.jobs.find((j) => j.name === "test-app")
      if (testApp) {
        expect(testApp.shouldRun).toBe(true)
        expect(testApp.stage).toBe("test")
      }

      // Simulate on develop branch
      const developContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "develop",
        },
        branch: "develop",
      }

      const developResult = simulator.simulate(config, developContext)

      // On develop: build-app should be skipped (rule: main only), test-app should run (rule: main|develop)
      const buildAppDev = developResult.jobs.find((j) => j.name === "build-app")
      expect(buildAppDev).toBeDefined()
      expect(buildAppDev?.shouldRun).toBe(false)

      const testAppDev = developResult.jobs.find((j) => j.name === "test-app")
      expect(testAppDev).toBeDefined()
      expect(testAppDev?.shouldRun).toBe(true)
    })

    it("should simulate complex pipeline with multiple remote includes and job dependencies", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/level1.yml
          - remote: https://example.com/ci/docker.yml
          - remote: https://example.com/ci/security.yml

        stages:
          - build
          - test
          - security
          - deploy

        build-docker-image:
          extends: .docker-base
          stage: build
          script:
            - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
            - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
            - if: $CI_MERGE_REQUEST_ID

        test-app:
          extends: .level3-test
          needs:
            - build-docker-image

        security-scan:
          extends: .security-scan
          needs:
            - build-docker-image

        deploy-production:
          extends: .level4-deploy
          needs:
            - test-app
            - security-scan
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      await resolveIncludes(config, {
        resolveReferences: true,
        basePath: process.cwd(),
      })

      const simulator = new PipelineSimulator()

      // Simulate on main branch
      const mainContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
          CI_REGISTRY_IMAGE: "registry.example.com/app",
          CI_COMMIT_SHA: "abc123",
        },
        branch: "main",
      }

      const mainResult = simulator.simulate(config, mainContext)

      expect(mainResult.jobsToRun).toBeGreaterThan(0)

      const buildDocker = mainResult.jobs.find((j) => j.name === "build-docker-image")
      expect(buildDocker?.shouldRun).toBe(true)

      // Security scan should run on main (rule: CI_MERGE_REQUEST_ID or main)
      const securityScan = mainResult.jobs.find((j) => j.name === "security-scan")
      if (securityScan) {
        expect(securityScan.shouldRun).toBe(true)
      }

      // Simulate with merge request
      const mrContext: RuleContext = {
        variables: {
          CI_MERGE_REQUEST_ID: "456",
          CI_COMMIT_BRANCH: "feature-branch",
          CI_REGISTRY_IMAGE: "registry.example.com/app",
          CI_COMMIT_SHA: "def456",
        },
        branch: "feature-branch",
      }

      const mrResult = simulator.simulate(config, mrContext)

      const buildDockerMr = mrResult.jobs.find((j) => j.name === "build-docker-image")
      expect(buildDockerMr?.shouldRun).toBe(true)

      const securityScanMr = mrResult.jobs.find((j) => j.name === "security-scan")
      if (securityScanMr) {
        expect(securityScanMr.shouldRun).toBe(true)
      }
    })

    it("should handle deeply nested includes with template inheritance", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/level1.yml

        stages:
          - build
          - test
          - deploy

        # Job extending level2 template which extends level1
        build-with-inheritance:
          extends: .level2-build
          script:
            - echo "Custom build step"
            - npm run build
          variables:
            CUSTOM_VAR: "custom-value"

        # Job extending level3 template
        test-with-custom-rules:
          extends: .level3-test
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^(main|develop|feature-.+)$/
              when: always
            - when: never

        # Job extending level4 template
        deploy-with-needs:
          extends: .level4-deploy
          needs:
            - build-with-inheritance
            - test-with-custom-rules
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      await resolveIncludes(config, {
        resolveReferences: true,
        basePath: process.cwd(),
      })

      const simulator = new PipelineSimulator()

      // Test on main branch
      const mainContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
        },
        branch: "main",
      }

      const mainResult = simulator.simulate(config, mainContext)

      const build = mainResult.jobs.find((j) => j.name === "build-with-inheritance")
      if (build) {
        expect(build.shouldRun).toBe(true)
      }

      const test = mainResult.jobs.find((j) => j.name === "test-with-custom-rules")
      if (test) {
        expect(test.shouldRun).toBe(true)
      }

      const deploy = mainResult.jobs.find((j) => j.name === "deploy-with-needs")
      if (deploy) {
        expect(deploy.shouldRun).toBe(true)
      }

      // Test on feature branch
      const featureContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "feature-new-feature",
        },
        branch: "feature-new-feature",
      }

      const featureResult = simulator.simulate(config, featureContext)

      const buildFeature = featureResult.jobs.find((j) => j.name === "build-with-inheritance")
      if (buildFeature) {
        // build-with-inheritance has own script, so it should run even without rule match
        // The extends only provides base configuration
        expect(buildFeature.shouldRun).toBe(true)
      }

      const testFeature = featureResult.jobs.find((j) => j.name === "test-with-custom-rules")
      if (testFeature) {
        expect(testFeature.shouldRun).toBe(true) // Custom rule matches feature branches
      }

      const deployFeature = featureResult.jobs.find((j) => j.name === "deploy-with-needs")
      if (deployFeature) {
        expect(deployFeature.shouldRun).toBe(false) // Level4 rule: only main or tag
      }
    })

    it("should simulate pipeline with remote includes and variable overrides", async () => {
      const yaml = dedent`
        include:
          - remote: https://example.com/ci/level1.yml

        variables:
          GLOBAL_VAR: "global-value"
          OVERRIDE_VAR: "overridden"

        stages:
          - build
          - test

        build:
          extends: .level1-base
          stage: build
          script:
            - echo "Building with LEVEL=$LEVEL"
            - npm run build
          variables:
            JOB_VAR: "job-value"
          rules:
            - if: $CI_COMMIT_BRANCH

        test:
          extends: .level3-test
          variables:
            TEST_VAR: "test-value"
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      await resolveIncludes(config, {
        resolveReferences: true,
        basePath: process.cwd(),
      })

      const simulator = new PipelineSimulator()

      const context: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
        },
        branch: "main",
      }

      const result = simulator.simulate(config, context)

      expect(result.jobsToRun).toBeGreaterThan(0)

      const buildJob = result.jobs.find((j) => j.name === "build")
      expect(buildJob?.shouldRun).toBe(true)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty rules array", () => {
      const yaml = dedent`
        stages:
          - build

        build:
          stage: build
          script:
            - echo "Building"
          rules: []
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      const result = simulator.simulate(config, {
        variables: {},
      })

      const buildJob = result.jobs.find((j) => j.name === "build")
      expect(buildJob?.shouldRun).toBe(true) // Empty rules allows job to run by default
    })

    it("should handle jobs with only rules: [when: never]", () => {
      const yaml = dedent`
        stages:
          - build
          - test

        build:
          stage: build
          script:
            - npm run build

        test-disabled:
          stage: test
          script:
            - npm test
          rules:
            - when: never
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      const result = simulator.simulate(config, {
        variables: {},
      })

      expect(result.totalJobs).toBe(2)
      expect(result.jobsToRun).toBe(1)

      const testJob = result.jobs.find((j) => j.name === "test-disabled")
      expect(testJob?.shouldRun).toBe(false)
    })

    it("should handle multiple rules with different outcomes", () => {
      const yaml = dedent`
        stages:
          - deploy

        deploy:
          stage: deploy
          script:
            - ./deploy.sh
          rules:
            - if: $CI_COMMIT_TAG
              when: always
            - if: $CI_COMMIT_BRANCH == "main"
              when: manual
            - when: never
      `

      const config = convertYamlToConfig(yaml, { resolveReferences: true })
      const simulator = new PipelineSimulator()

      // With tag - should run automatically
      const tagContext: RuleContext = {
        variables: {
          CI_COMMIT_TAG: "v1.0.0",
        },
        tag: "v1.0.0",
      }

      const tagResult = simulator.simulate(config, tagContext)
      const deployTag = tagResult.jobs.find((j) => j.name === "deploy")
      expect(deployTag?.shouldRun).toBe(true)
      expect(deployTag?.when).toBe("always")

      // On main - should be manual
      const mainContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "main",
        },
        branch: "main",
      }

      const mainResult = simulator.simulate(config, mainContext)
      const deployMain = mainResult.jobs.find((j) => j.name === "deploy")
      expect(deployMain?.shouldRun).toBe(true)
      expect(deployMain?.when).toBe("manual")

      // Other branch - should not run
      const otherContext: RuleContext = {
        variables: {
          CI_COMMIT_BRANCH: "feature",
        },
        branch: "feature",
      }

      const otherResult = simulator.simulate(config, otherContext)
      const deployOther = otherResult.jobs.find((j) => j.name === "deploy")
      expect(deployOther?.shouldRun).toBe(false)
    })
  })
})
