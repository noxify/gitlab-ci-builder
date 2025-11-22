import { describe, expect, it } from "vitest"

import { fromYaml } from "../src/import"

describe("Import Integration with ConfigBuilder", () => {
  it("should use ConfigBuilder by default", () => {
    const yaml = `
stages:
  - build

build:
  script:
    - npm run build
`

    const ts = fromYaml(yaml)

    expect(ts).toContain('import { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
    expect(ts).toContain("const config = new ConfigBuilder()")
  })

  it("should support asExtendedConfig", () => {
    const yaml = `
build:
  script:
    - echo build
`

    const ts = fromYaml(yaml, { asExtendedConfig: true })

    expect(ts).toContain('import type { ConfigBuilder } from "@noxify/gitlab-ci-builder"')
    expect(ts).toContain("export default function (config: ConfigBuilder) {")
    expect(ts).toContain("  return config")
  })

  it("should handle complex YAML with ConfigBuilder", () => {
    const yaml = `
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
