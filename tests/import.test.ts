import fs from "fs/promises"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fromYaml, importYamlFile } from "../src/import"

describe("import", () => {
  describe("fromYaml()", () => {
    it("should convert simple YAML to TypeScript config", () => {
      const yaml = `
stages:
  - build
  - test

build-job:
  stage: build
  script:
    - npm run build
`

      const ts = fromYaml(yaml)

      expect(ts).toContain('import { Config } from "@noxify/gitlab-ci-builder"')
      expect(ts).toContain('config.stages("build", "test")')
      expect(ts).toContain('config.job("build-job",')
      expect(ts).toContain('stage: "build"')
      expect(ts).toContain('script: ["npm run build"]')
      expect(ts).toContain("export default config")
    })

    it("should handle templates (hidden jobs)", () => {
      const yaml = `
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

    it("should handle workflow", () => {
      const yaml = `
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
      const yaml = `
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
      const yaml = `
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
      const yaml = `
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
      const yaml = `
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
      const yaml = `
test:
  script:
    - echo test
`

      const ts = fromYaml(yaml)

      expect(ts).not.toContain("config.stages(")
      expect(ts).toContain('config.job("test",')
    })

    it("should order templates before jobs", () => {
      const yaml = `
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

    it("should handle multiline scripts", () => {
      const yaml = `
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
  })

  describe("importYamlFile()", () => {
    const testYamlPath = "/tmp/test-gitlab-ci.yml"
    const testOutputPath = "/tmp/test-config.ts"

    beforeEach(() => {
      vi.spyOn(fs, "readFile").mockResolvedValue(`
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
      expect(result).toContain('import { Config } from "@noxify/gitlab-ci-builder"')
      expect(result).toContain('config.stages("build")')
    })

    it("should write to output file when path is provided", async () => {
      await importYamlFile(testYamlPath, testOutputPath)

      expect(fs.writeFile).toHaveBeenCalledWith(
        testOutputPath,
        expect.stringContaining('import { Config } from "@noxify/gitlab-ci-builder"'),
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
  })

  describe("complex examples", () => {
    it("should handle a complex GitLab CI YAML", () => {
      const yaml = `
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

    it("should handle anchors", () => {
      const yaml = `
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

    it("should handle extends with strings", () => {
      const yaml = `
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
      const yaml = `
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
  })
})
