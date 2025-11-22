import { describe, it } from "vitest"

import { loadLocalTemplate, setupTemplateTest, testTemplateRoundTrip } from "./test-helper"

const { generatedDir, testFilesDir } = setupTemplateTest(import.meta.dirname, "infrastructure")

describe("GitLab Templates: Infrastructure", () => {
  it("should handle OpenTofu.latest template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "OpenTofu.latest.gitlab-ci.yml")
    await testTemplateRoundTrip("OpenTofu.latest", yaml, generatedDir)
  })

  it("should handle Code-Quality template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Code-Quality.gitlab-ci.yml")
    await testTemplateRoundTrip("Code-Quality", yaml, generatedDir)
  })

  it("should handle Getting-Started template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Getting-Started.gitlab-ci.yml")
    await testTemplateRoundTrip("Getting-Started", yaml, generatedDir)
  })
})
