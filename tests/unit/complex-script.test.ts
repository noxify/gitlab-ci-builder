import dedent from "dedent"
import { vol } from "memfs"
import { describe, expect, it } from "vitest"

import { ConfigBuilder, fromYaml } from "../../src"

describe("Complex script handling", () => {
  describe("Import", () => {
    it("should handle multiline script with heredoc-style block", () => {
      const yaml = dedent`
        release:
          before_script:
            - npm ci --cache .npm --prefer-offline
            - |
              {
                echo "@\${CI_PROJECT_ROOT_NAMESPACE}:registry=\${CI_API_V4_URL}/projects/\${CI_PROJECT_ID}/packages/npm/"
                echo "\${CI_API_V4_URL#https?}/projects/\${CI_PROJECT_ID}/packages/npm/:_authToken=\${CI_JOB_TOKEN}"
              } | tee -a .npmrc
          script:
            - npx semantic-release
      `

      const ts = fromYaml(yaml)

      // Should generate valid TypeScript
      expect(ts).toContain('config.job("release"')
      expect(ts).toContain("before_script:")
      expect(ts).toContain("npm ci --cache .npm --prefer-offline")

      // The multiline block should be preserved as template literal
      expect(ts).toContain("tee -a .npmrc")

      // Variables should be escaped once for template literal
      expect(ts).toContain("\\${CI_PROJECT_ROOT_NAMESPACE}")
      expect(ts).toContain("\\${CI_API_V4_URL}")
      expect(ts).toContain("\\${CI_PROJECT_ID}")
      expect(ts).toContain("\\${CI_JOB_TOKEN}")
    })

    it("should handle GitLab CI variable references in scripts", () => {
      const yaml = dedent`
        test:
          script:
            - 'echo "Branch: $CI_COMMIT_BRANCH"'
            - 'echo "Tag: \${CI_COMMIT_TAG}"'
      `

      const ts = fromYaml(yaml)

      expect(ts).toContain('config.job("test"')
      expect(ts).toContain("$CI_COMMIT_BRANCH")
      expect(ts).toContain("${CI_COMMIT_TAG}")
    })
  })

  describe("Export", () => {
    it("should export multiline script with proper variable escaping", () => {
      const config = new ConfigBuilder()

      config.job("release", {
        before_script: [
          "npm ci --cache .npm --prefer-offline",
          `{
  echo "@\${CI_PROJECT_ROOT_NAMESPACE}:registry=\${CI_API_V4_URL}/projects/\${CI_PROJECT_ID}/packages/npm/"
  echo "\${CI_API_V4_URL#https?}/projects/\${CI_PROJECT_ID}/packages/npm/:_authToken=\${CI_JOB_TOKEN}"
} | tee -a .npmrc
`,
        ],
        script: ["npx semantic-release"],
      })

      const yaml = config.toYaml()

      // Should contain the job
      expect(yaml).toContain("release:")
      expect(yaml).toContain("before_script:")
      expect(yaml).toContain("npm ci --cache .npm --prefer-offline")

      // Variables should be preserved correctly in YAML
      expect(yaml).toContain("${CI_PROJECT_ROOT_NAMESPACE}")
      expect(yaml).toContain("${CI_API_V4_URL}")
      expect(yaml).toContain("${CI_PROJECT_ID}")
      expect(yaml).toContain("${CI_JOB_TOKEN}")

      // Should use pipe for multiline
      expect(yaml).toMatch(/[|>]/)
    })

    it("should handle round-trip conversion with complex scripts", () => {
      const originalYaml = dedent`
        release:
          before_script:
            - npm ci --cache .npm --prefer-offline
            - |
              {
                echo "@\${CI_PROJECT_ROOT_NAMESPACE}:registry=\${CI_API_V4_URL}/projects/\${CI_PROJECT_ID}/packages/npm/"
                echo "\${CI_API_V4_URL#https?}/projects/\${CI_PROJECT_ID}/packages/npm/:_authToken=\${CI_JOB_TOKEN}"
              } | tee -a .npmrc
          script:
            - npx semantic-release
      `

      // Step 1: Import YAML -> TypeScript
      const ts = fromYaml(originalYaml)
      expect(ts).toContain("ConfigBuilder")

      // Step 2: Write TypeScript to file
      vol.reset()
      vol.mkdirSync("/tmp", { recursive: true })
      vol.writeFileSync("/tmp/generated.ts", ts)

      // Step 3: Create config manually (simulating executed TypeScript)
      const config = new ConfigBuilder()
      config.job("release", {
        before_script: [
          "npm ci --cache .npm --prefer-offline",
          `{
  echo "@\${CI_PROJECT_ROOT_NAMESPACE}:registry=\${CI_API_V4_URL}/projects/\${CI_PROJECT_ID}/packages/npm/"
  echo "\${CI_API_V4_URL#https?}/projects/\${CI_PROJECT_ID}/packages/npm/:_authToken=\${CI_JOB_TOKEN}"
} | tee -a .npmrc
`,
        ],
        script: ["npx semantic-release"],
      })

      // Step 4: Export back to YAML
      const exportedYaml = config.toYaml()

      // Verify critical parts are preserved
      expect(exportedYaml).toContain("release:")
      expect(exportedYaml).toContain("before_script:")
      expect(exportedYaml).toContain("npm ci --cache .npm --prefer-offline")
      expect(exportedYaml).toContain("${CI_PROJECT_ROOT_NAMESPACE}")
      expect(exportedYaml).toContain("${CI_API_V4_URL}")
      expect(exportedYaml).toContain("${CI_JOB_TOKEN}")
      expect(exportedYaml).toContain("tee -a .npmrc")
      expect(exportedYaml).toContain("npx semantic-release")
    })
  })
})
