import { describe, expect, it } from "vitest"

import { fromYaml } from "../src/refactor/importer"

describe("Refactored Importer", () => {
  describe("fromYaml()", () => {
    it("should convert simple YAML to TypeScript config with ConfigBuilder", () => {
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

      expect(ts).toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).toContain("const config = new ConfigBuilder()")
      expect(ts).toContain('config.stages("build", "test")')
      expect(ts).toContain('config.job("build-job",')
      expect(ts).toContain('stage: "build"')
      expect(ts).toContain('script: ["npm run build"]')
      expect(ts).toContain("export default config")
    })

    it("should handle templates with ConfigBuilder", () => {
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

    it("should use type-only import with asExtendedConfig", () => {
      const yaml = `
stages:
  - build

build:
  script:
    - echo build
`

      const ts = fromYaml(yaml, { asExtendedConfig: true })

      expect(ts).toContain('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
      expect(ts).not.toContain("import { ConfigBuilder }")
      expect(ts).toContain("export default function (config: ConfigBuilder) {")
      expect(ts).toContain('  config.stages("build")')
      expect(ts).toContain("  return config")
      expect(ts).not.toContain("const config = new ConfigBuilder()")
    })

    it("should handle workflow and defaults", () => {
      const yaml = `
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH

default:
  image: alpine:latest
  retry:
    max: 2
`

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.workflow({")
      expect(ts).toContain("rules:")
      expect(ts).toContain("config.defaults({")
      expect(ts).toContain('image: "alpine:latest"')
      expect(ts).toContain("retry:")
      expect(ts).toContain("max: 2")
    })

    it("should handle variables", () => {
      const yaml = `
variables:
  NODE_VERSION: "20"
  DEBUG: true
  COUNT: 5
`

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.variables({")
      expect(ts).toContain('"NODE_VERSION": "20"')
      expect(ts).toContain('"DEBUG": true')
      expect(ts).toContain('"COUNT": 5')
    })

    it("should handle include", () => {
      const yaml = `
include:
  - local: /templates/base.yml
  - remote: https://example.com/ci.yml
  - template: Security/SAST.gitlab-ci.yml
`

      const ts = fromYaml(yaml)

      expect(ts).toContain("config.include({")
      expect(ts).toContain('local: "/templates/base.yml"')
      expect(ts).toContain("config.include({")
      expect(ts).toContain('remote: "https://example.com/ci.yml"')
      expect(ts).toContain("config.include({")
      expect(ts).toContain('template: "Security/SAST.gitlab-ci.yml"')
    })

    it("should format complex script values", () => {
      const yaml = `
build:
  script:
    - npm install
    - npm run build
    - echo "Build complete"
`

      const ts = fromYaml(yaml)

      expect(ts).toContain('script: ["npm install", "npm run build", "echo \\"Build complete\\""]')
    })

    it("should handle multi-line scripts with shell operators as template literals", () => {
      const yaml = `
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

    it("should handle !reference tags", () => {
      const yaml = `
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
  })
})
