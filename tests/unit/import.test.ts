import fs from "fs/promises"
import dedent from "dedent"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fromYaml, importYamlFile } from "../../src/import"

describe("YAML Import", () => {
  describe("fromYaml() - Basic Conversion", () => {
    it("should convert simple YAML to TypeScript config", () => {
      const yaml = dedent`
        stages:
          - build
          - test

        build-job:
          stage: build
          script:
            - npm run build
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).toContain("const config = new ConfigBuilder()")
      expect(ts).toContain('config.stages("build", "test")')
      expect(ts).toContain('config.job("build-job",')
      expect(ts).toContain('stage: "build"')
      expect(ts).toContain('script: ["npm run build"]')
      expect(ts).toContain("export default config")
    })

    it("should handle templates (hidden jobs)", () => {
      const yaml = dedent`
        .template:
          image: node:22
          tags:
            - docker

        build:
          extends: .template
          script:
            - npm run build
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.template(".template",')
      expect(ts).toContain('image: "node:22"')
      expect(ts).toContain('config.job("build",')
      expect(ts).toContain('extends: ".template"')
    })

    it("should normalize single-element array extends to string", () => {
      const yaml = dedent`
        .base-cache:
          cache:
            key: my-cache
            paths:
              - node_modules/

        test:
          extends: [.base-cache]
          script:
            - npm test
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.template(".base-cache",')
      expect(ts).toContain('config.job("test",')
      // Single-element array is normalized to string for cleaner generated code
      expect(ts).toContain('extends: ".base-cache"')
      expect(ts).not.toContain('extends: [".base-cache"]')
    })

    it("should handle workflow", () => {
      const yaml = dedent`
        workflow:
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
              when: always

        test:
          script:
            - echo test
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.workflow({")
      expect(ts).toContain("rules:")
      expect(ts).toContain('if: "$CI_COMMIT_BRANCH == \\"main\\""')
      expect(ts).toContain('when: "always"')
    })

    it("should handle variables", () => {
      const yaml = dedent`
        variables:
          NODE_ENV: production
          DEBUG: false
          PORT: 3000

        test:
          script:
            - echo test
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.variables({")
      expect(ts).toContain('"NODE_ENV": "production"')
      expect(ts).toContain('"DEBUG": false')
      expect(ts).toContain('"PORT": 3000')
    })

    it("should handle includes", () => {
      const yaml = dedent`
        include:
          - local: local.yml
          - remote: https://example.com/template.yml

        test:
          script:
            - echo test
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.include({")
      expect(ts).toContain('local: "local.yml"')
      expect(ts).toContain('remote: "https://example.com/template.yml"')
    })

    it("should handle default configuration", () => {
      const yaml = dedent`
        default:
          image: node:22
          tags:
            - docker

        test:
          script:
            - echo test
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.defaults({")
      expect(ts).toContain('image: "node:22"')
      expect(ts).toContain('tags: ["docker"]')
    })

    it("should handle complex job definitions", () => {
      const yaml = dedent`
        deploy:
          stage: deploy
          script:
            - kubectl apply -f k8s/
          environment:
            name: production
            url: https://example.com
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
          tags:
            - kubernetes
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.job("deploy",')
      expect(ts).toContain('stage: "deploy"')
      expect(ts).toContain('script: ["kubectl apply -f k8s/"]')
      expect(ts).toContain("environment: {")
      expect(ts).toContain('name: "production"')
      expect(ts).toContain('url: "https://example.com"')
      expect(ts).toContain("rules:")
      expect(ts).toContain('tags: ["kubernetes"]')
    })

    it("should handle empty stages array", () => {
      const yaml = dedent`
        test:
          script:
            - echo test
      `

      const ts = fromYaml(yaml)

      expect(ts).not.toContain("config.stages(")
      expect(ts).toContain('config.job("test",')
    })

    it("should order templates before jobs", () => {
      const yaml = dedent`
        build:
          script:
            - npm run build

        .template:
          image: node:22

        test:
          script:
            - npm test
      `

      const ts = fromYaml(yaml)

      const templateIndex = ts.indexOf('config.template(".template"')
      const buildIndex = ts.indexOf('config.job("build"')
      const testIndex = ts.indexOf('config.job("test"')

      // Template should come before jobs
      expect(templateIndex).toBeGreaterThan(-1)
      expect(buildIndex).toBeGreaterThan(-1)
      expect(testIndex).toBeGreaterThan(-1)
      expect(templateIndex).toBeLessThan(buildIndex)
      expect(templateIndex).toBeLessThan(testIndex)
    })
  })

  describe("fromYaml() - Extended Config Mode", () => {
    it("should use type-only import and function export when asExtendedConfig is true", () => {
      const yaml = dedent`
        stages:
          - build
          - test

        build-job:
          stage: build
          script:
            - npm run build
      `

      const ts = fromYaml(yaml, { asExtendedConfig: true })

      expect(ts).toContain('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).not.toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).toContain("export default function (config: ConfigBuilder) {")
      expect(ts).toContain('  config.stages("build", "test")')
      expect(ts).toContain('  config.job("build-job",')
      expect(ts).toContain("  return config")
      expect(ts).toContain("}")
      expect(ts).not.toContain("const config = new ConfigBuilder()")
      expect(ts).not.toContain("export default config")
    })

    it("should use regular import and direct export by default", () => {
      const yaml = dedent`
        stages:
          - build
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).not.toContain('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).toContain("const config = new ConfigBuilder()")
      expect(ts).toContain("export default config")
      expect(ts).not.toContain("export default function")
      expect(ts).not.toContain("return config")
    })

    it("should properly indent all config calls when asExtendedConfig is true", () => {
      const yaml = dedent`
        variables:
          NODE_ENV: production

        .base:
          image: node:22

        test:
          extends: .base
          script:
            - npm test
      `

      const ts = fromYaml(yaml, { asExtendedConfig: true })

      expect(ts).toContain("export default function (config: ConfigBuilder) {")
      expect(ts).toContain("  config.variables({")
      expect(ts).toContain('  config.template(".base",')
      expect(ts).toContain('  config.job("test",')
      expect(ts).toContain("  return config")
    })
  })

  describe("fromYaml() - Script Handling", () => {
    it("should handle multiline scripts", () => {
      const yaml = dedent`
        build:
          script:
            - echo "Building..."
            - npm install
            - npm run build
            - echo "Done"
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('echo \\"Building...\\"')
      expect(ts).toContain('"npm install"')
      expect(ts).toContain('"npm run build"')
      expect(ts).toContain('echo \\"Done\\"')
    })

    it("should preserve shell control structures (if/then/else/fi)", () => {
      const yaml = dedent`
        deploy:
          script:
            - |
              if [ "$MANUAL_PROD_DEPLOYMENT" = "true" ]; then
                echo "🚨 MANUAL PRODUCTION DEPLOYMENT TRIGGERED 🚨"
              else
                echo "📦 Automated production deployment via changeset release"
              fi
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.job("deploy",')
      // Should be preserved as a template literal, not split into array
      expect(ts).toContain("if [")
      expect(ts).toContain("then")
      expect(ts).toContain("else")
      expect(ts).toContain("fi")
      // Should be in a single script item (template literal in array)
      expect(ts).toMatch(/script: \[`[\s\S]*if \[[\s\S]*then[\s\S]*else[\s\S]*fi[\s\S]*`\]/)
    })

    it("should preserve shell for loops", () => {
      const yaml = dedent`
        job:
          script:
            - |
              for i in 1 2 3; do
                echo "Item $i"
              done
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("for i in")
      expect(ts).toContain("do")
      expect(ts).toContain("done")
      expect(ts).toMatch(/script: \[`[\s\S]*for[\s\S]*do[\s\S]*done[\s\S]*`\]/)
    })

    it("should preserve shell case statements", () => {
      const yaml = dedent`
        job:
          script:
            - |
              case $ENV in
                prod)
                  echo "Production"
                  ;;
                dev)
                  echo "Development"
                  ;;
              esac
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("case")
      expect(ts).toContain("esac")
      expect(ts).toMatch(/script: \[`[\s\S]*case[\s\S]*esac[\s\S]*`\]/)
    })

    it("should handle multi-line scripts with shell operators as template literals", () => {
      const yaml = dedent`
        build:
          script:
            - |
              if [ -f package.json ]; then
                npm install
              fi
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("script: [`")
      expect(ts).toContain("if [ -f package.json ]; then")
      expect(ts).toContain("npm install")
      expect(ts).toContain("fi")
      expect(ts).toContain("`]")
    })
  })

  describe("fromYaml() - Advanced Features", () => {
    it("should handle extends with strings", () => {
      const yaml = dedent`
        .base:
          image: node:22

        build:
          extends: .base
          script:
            - npm run build
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.template(".base",')
      expect(ts).toContain('config.job("build",')
      expect(ts).toContain('extends: ".base"')
    })

    it("should handle extends with arrays", () => {
      const yaml = dedent`
        .base1:
          image: node:22

        .base2:
          tags:
            - docker

        build:
          extends:
            - .base1
            - .base2
          script:
            - npm run build
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.template(".base1",')
      expect(ts).toContain('config.template(".base2",')
      expect(ts).toContain('config.job("build",')
      expect(ts).toContain('extends: [".base1", ".base2"]')
    })

    it("should handle needs with optional property", () => {
      const yaml = dedent`
        generate_version:
          script:
            - echo version

        unit_tests:
          script:
            - npm test

        deploy:
          script:
            - echo deploying
          needs:
            - job: generate_version
              optional: true
            - job: unit_tests
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.job("deploy",')
      expect(ts).toContain("needs:")
      expect(ts).toContain('job: "generate_version"')
      expect(ts).toContain("optional: true")
      expect(ts).toContain('job: "unit_tests"')
    })

    it("should handle artifacts.reports.annotations as single string", () => {
      const yaml = dedent`
        test:
          script:
            - npm test
          artifacts:
            reports:
              annotations:
                - branding.json
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.job("test",')
      expect(ts).toContain("artifacts:")
      expect(ts).toContain("reports:")
      expect(ts).toContain('annotations: "branding.json"')
    })

    it("should handle artifacts.reports.annotations as array", () => {
      const yaml = dedent`
        test:
          script:
            - npm test
          artifacts:
            reports:
              annotations:
                - file1.json
                - file2.json
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.job("test",')
      expect(ts).toContain("artifacts:")
      expect(ts).toContain("reports:")
      expect(ts).toContain('annotations: ["file1.json", "file2.json"]')
    })

    it("should handle !reference tags", () => {
      const yaml = dedent`
        .base:
          script:
            - npm install

        build:
          script:
            - !reference [.base, script]
            - npm run build
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('"!reference [.base, script]"')
      expect(ts).toContain('"npm run build"')
    })

    it("should handle anchors", () => {
      const yaml = dedent`
        .tags_test: &tags_test
          - test1
          - test2

        .job_template: &job_configuration
          script:
            - test project
          tags:
            - dev

        .postgres_services:
          services: &postgres_configuration
            - postgres
            - ruby

        .mysql_services:
          services: &mysql_configuration
            - mysql
            - ruby

        test:postgres:
          <<: *job_configuration
          services: *postgres_configuration
          tags:
            - postgres

        test:mysql:
          <<: *job_configuration
          services: *mysql_configuration
      `

      const ts = fromYaml(yaml)

      // Anchor-only definitions (.tags_test) should be ignored
      expect(ts).not.toContain('config.template(".tags_test"')

      // Templates with actual job definitions should be included
      expect(ts).toContain('config.template(".postgres_services"')
      expect(ts).toContain('config.template(".mysql_services"')
      expect(ts).toContain('config.template(".job_template"')

      // Jobs should reference the merged anchor values
      expect(ts).toContain('config.job("test:postgres"')
      expect(ts).toContain('config.job("test:mysql"')
      expect(ts).toContain('services: ["postgres", "ruby"]')
      expect(ts).toContain('services: ["mysql", "ruby"]')

      // Merged script from anchor should be present
      expect(ts).toContain('"test project"')
    })
  })

  describe("fromYaml() - Complex Examples", () => {
    it("should handle a complex GitLab CI YAML", () => {
      const yaml = dedent`
        .tags_test: &tags_test
          - test1
          - test2

        download_node_modules:
          stage: init
          tags: *tags_test
          image: $NODE_ALPINE_IMAGE
          script:
            - !reference [.pnpm_install_template, script]
          cache:
            - key: \${NPM_CACHE_KEY}
              paths:
                - /node_modules
                - /.pnpm-store
              policy: pull-push
          variables:
            APP_DIR: "."
            NPM_CACHE_KEY: default

        deploy-job:
          stage: deploy
          script:
            - echo "Deploying..."
          environment:
            name: production
            url: https://example.com
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
              when: always
      `

      const ts = fromYaml(yaml)
      expect(ts).toContain('"!reference [.pnpm_install_template, script]"')
    })

    it("should handle complex YAML with all features", () => {
      const yaml = dedent`
        workflow:
          rules:
            - if: $CI_COMMIT_BRANCH == "main"

        variables:
          NODE_VERSION: "20"

        default:
          image: node:$NODE_VERSION
          cache:
            paths:
              - node_modules/

        .base:
          before_script:
            - npm install

        build:
          extends: .base
          stage: build
          script:
            - npm run build
          artifacts:
            paths:
              - dist/

        test:
          extends: .base
          stage: test
          script:
            - npm test
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.workflow({")
      expect(ts).toContain("config.variables({")
      expect(ts).toContain("config.defaults({")
      expect(ts).toContain('config.template(".base",')
      expect(ts).toContain('config.job("build",')
      expect(ts).toContain('config.job("test",')
      expect(ts).toContain("artifacts:")
    })
  })

  describe("importYamlFile()", () => {
    const testYamlPath = "/tmp/test-gitlab-ci.yml"
    const testOutputPath = "/tmp/test-config.ts"

    beforeEach(() => {
      vi.spyOn(fs, "readFile").mockResolvedValue(dedent`
        stages:
          - build

        build:
          stage: build
          script:
            - npm run build
      `)
      vi.spyOn(fs, "writeFile").mockResolvedValue()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("should read YAML file and convert to TypeScript", async () => {
      const result = await importYamlFile(testYamlPath)

      expect(fs.readFile).toHaveBeenCalledWith(testYamlPath, "utf-8")
      expect(result).toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(result).toContain('config.stages("build")')
    })

    it("should write to output file when path is provided", async () => {
      await importYamlFile(testYamlPath, testOutputPath)

      expect(fs.writeFile).toHaveBeenCalledWith(
        testOutputPath,
        expect.stringContaining('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"'),
        "utf-8",
      )
    })

    it("should not write file when output path is not provided", async () => {
      await importYamlFile(testYamlPath)

      expect(fs.writeFile).not.toHaveBeenCalled()
    })

    it("should handle read errors", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))

      await expect(importYamlFile(testYamlPath)).rejects.toThrow("File not found")
    })

    it("should use type-only import when asExtendedConfig is true", async () => {
      const result = await importYamlFile(testYamlPath, undefined, { asExtendedConfig: true })

      expect(fs.readFile).toHaveBeenCalledWith(testYamlPath, "utf-8")
      expect(result).toContain('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(result).not.toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(result).toContain("export default function (config: ConfigBuilder) {")
      expect(result).toContain('  config.stages("build")')
      expect(result).toContain("  return config")
    })

    it("should use regular import when asExtendedConfig is false", async () => {
      const result = await importYamlFile(testYamlPath, undefined, { asExtendedConfig: false })

      expect(fs.readFile).toHaveBeenCalledWith(testYamlPath, "utf-8")
      expect(result).toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(result).not.toContain('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(result).toContain("const config = new ConfigBuilder()")
      expect(result).toContain("export default config")
    })

    it("should write function-based export to file when asExtendedConfig is true", async () => {
      await importYamlFile(testYamlPath, testOutputPath, { asExtendedConfig: true })

      expect(fs.writeFile).toHaveBeenCalledWith(
        testOutputPath,
        expect.stringContaining('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"'),
        "utf-8",
      )
      expect(fs.writeFile).toHaveBeenCalledWith(
        testOutputPath,
        expect.stringContaining("export default function (config: ConfigBuilder) {"),
        "utf-8",
      )
      expect(fs.writeFile).toHaveBeenCalledWith(
        testOutputPath,
        expect.stringContaining("  return config"),
        "utf-8",
      )
    })
  })
})
