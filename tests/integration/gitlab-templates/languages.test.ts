import { describe, it } from "vitest"

import { loadLocalTemplate, setupTemplateTest, testTemplateRoundTrip } from "./test-helper"

const { generatedDir, testFilesDir } = setupTemplateTest(import.meta.dirname, "languages")

describe("GitLab Templates: Languages", () => {
  it("should handle Android template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Android.gitlab-ci.yml")
    await testTemplateRoundTrip("Android", yaml, generatedDir)
  })

  it("should handle Bash template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Bash.gitlab-ci.yml")
    await testTemplateRoundTrip("Bash", yaml, generatedDir)
  })

  it("should handle C++ template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "C++.gitlab-ci.yml")
    await testTemplateRoundTrip("C++", yaml, generatedDir)
  })

  it("should handle Crystal template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Crystal.gitlab-ci.yml")
    await testTemplateRoundTrip("Crystal", yaml, generatedDir)
  })

  it("should handle Django template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Django.gitlab-ci.yml")
    await testTemplateRoundTrip("Django", yaml, generatedDir)
  })

  it("should handle Docker template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Docker.gitlab-ci.yml")
    await testTemplateRoundTrip("Docker", yaml, generatedDir)
  })

  it("should handle Elixir template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Elixir.gitlab-ci.yml")
    await testTemplateRoundTrip("Elixir", yaml, generatedDir)
  })

  it("should handle Go template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Go.gitlab-ci.yml")
    await testTemplateRoundTrip("Go", yaml, generatedDir)
  })

  it("should handle Gradle template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Gradle.gitlab-ci.yml")
    await testTemplateRoundTrip("Gradle", yaml, generatedDir)
  })

  it("should handle Julia template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Julia.gitlab-ci.yml")
    await testTemplateRoundTrip("Julia", yaml, generatedDir)
  })

  it("should handle LaTeX template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "LaTeX.gitlab-ci.yml")
    await testTemplateRoundTrip("LaTeX", yaml, generatedDir)
  })

  it("should handle Maven template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Maven.gitlab-ci.yml")
    await testTemplateRoundTrip("Maven", yaml, generatedDir)
  })

  it("should handle Nodejs template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Nodejs.gitlab-ci.yml")
    await testTemplateRoundTrip("Nodejs", yaml, generatedDir)
  })

  it("should handle PHP template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "PHP.gitlab-ci.yml")
    await testTemplateRoundTrip("PHP", yaml, generatedDir)
  })

  it("should handle Python template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Python.gitlab-ci.yml")
    await testTemplateRoundTrip("Python", yaml, generatedDir)
  })

  it("should handle Ruby template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Ruby.gitlab-ci.yml")
    await testTemplateRoundTrip("Ruby", yaml, generatedDir)
  })

  it("should handle Rust template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Rust.gitlab-ci.yml")
    await testTemplateRoundTrip("Rust", yaml, generatedDir)
  })

  it("should handle Swift template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "Swift.gitlab-ci.yml")
    await testTemplateRoundTrip("Swift", yaml, generatedDir)
  })

  it("should handle dotNET-Core template", async () => {
    const yaml = loadLocalTemplate(testFilesDir, "dotNET-Core.gitlab-ci.yml")
    await testTemplateRoundTrip("dotNET-Core", yaml, generatedDir)
  })
})
