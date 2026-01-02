import { mkdir, rm, writeFile } from "fs/promises"
import { join } from "path"
import type { Session } from "tuistory"
import dedent from "dedent"
import { launchTerminal } from "tuistory"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const CLI_PATH = join(process.cwd(), "dist", "cli", "index.mjs")
const TEST_DIR = join(process.cwd(), ".test-tmp")

// Helper to clean up terminal output by removing excessive trailing newlines
function cleanOutput(text: string): string {
  return text.trimEnd() + "\n"
}

describe("CLI simulate command - E2E Tests", () => {
  let session: Session | undefined

  beforeEach(async () => {
    // Create temp directory for test files
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    // Clean up session
    if (session) {
      session.close()
      session = undefined
    }

    // Clean up test files
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe("Basic Command Usage", () => {
    it("should display help text", async () => {
      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", "--help"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Simulate GitLab CI pipeline execution", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "
        Usage: gitlab-ci-builder simulate [options] <path-or-url>

        Simulate GitLab CI pipeline execution based on variables and rules

        Arguments:
          path-or-url                    Path to .gitlab-ci.yml file or remote URL

        Options:
          -v, --variable <key=value...>  Set pipeline variables (can be used multiple times)
          -b, --branch <branch>          Simulate for specific branch
          --tag <tag>                    Simulate for specific tag
          --mr                           Simulate merge request pipeline
          --mr-labels <labels...>        Merge request labels (comma-separated)
          -f, --format <format>          Output format: text, json, yaml, table, summary (default: "summary")
          --show-skipped                 Show skipped jobs in output (default: false)
          --verbose                      Verbose output with detailed rule evaluation (default: false)
          -t, --token <token>            Authentication token for private repositories (or use GITLAB_TOKEN env var)
          --host <host>                  GitLab host for project/template includes (or use GITLAB_HOST env var) (default:
                                         "gitlab.com")
          -h, --help                     display help for command

        Examples:
          $ gitlab-ci-builder simulate .gitlab-ci.yml -b main
          $ gitlab-ci-builder simulate .gitlab-ci.yml -v CI_COMMIT_BRANCH=main -v JOB_DISABLED=true
          $ gitlab-ci-builder simulate pipeline.yml --branch develop --mr
          $ gitlab-ci-builder simulate .gitlab-ci.yml -f table --show-skipped
          $ gitlab-ci-builder simulate https://gitlab.com/org/repo/-/raw/main/.gitlab-ci.yml -t <token>
          $ gitlab-ci-builder simulate .gitlab-ci.yml -f json > simulation.json
        "
      `)
    })

    it("should show error for missing file", async () => {
      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", "nonexistent.yml"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Error", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "
        Error: Error: ENOENT: no such file or directory, open 'nonexistent.yml'
            at async open (node:internal/fs/promises:642:25)
            at async readFile (node:internal/fs/promises:1279:14)
            at async Command.<anonymous> (file:///Users/marcusreinhardt/Development/gitlab-ci-builder/dist/cli/index.mjs:42:25)
            at async Command.parseAsync (/Users/marcusreinhardt/Development/gitlab-ci-builder/node_modules/.pnpm/commander@14.0.
        2/node_modules/commander/lib/command.js:1122:5)
            at async main (file:///Users/marcusreinhardt/Development/gitlab-ci-builder/dist/cli/index.mjs:246:2) {
          errno: -2,
          code: 'ENOENT',
          syscall: 'open',
          path: 'nonexistent.yml'
        }
        "
      `)
    })
  })

  describe("Simple Pipeline Simulation", () => {
    it("should simulate simple pipeline and show summary", async () => {
      const yamlContent = dedent`
        stages:
          - build
          - test
          - deploy

        build-job:
          stage: build
          script:
            - echo "Building..."

        test-job:
          stage: test
          script:
            - echo "Testing..."

        deploy-job:
          stage: deploy
          script:
            - echo "Deploying..."
      `

      const yamlPath = join(TEST_DIR, "simple-pipeline.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    3
        Will Run:      3
          - Automatic: 3
          - Manual:    0
        Will Skip:     0

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)
          test: 1 job(s)
          deploy: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ build-job (build)
          ▶ test-job (test)
          ▶ deploy-job (deploy)
        "
      `)
    })

    it("should output JSON format", async () => {
      const yamlContent = dedent`
        stages:
          - build

        build-job:
          stage: build
          script:
            - echo "Building..."
      `

      const yamlPath = join(TEST_DIR, "json-format.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-f", "json"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText('"jobs"', { timeout: 5000 })

      const output = await session.text()

      // Verify it's valid JSON
      expect(output).toContain('"jobs"')
      expect(output).toContain('"totalJobs"')
      expect(output).toContain('"jobsToRun"')
      expect(output).toContain('"jobsSkipped"')

      // Try to parse as JSON (should not throw)
      const jsonMatch = /\{[\s\S]*\}/.exec(output)
      expect(jsonMatch).toBeTruthy()
      if (jsonMatch) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(jsonMatch[0])
        expect(parsed).toHaveProperty("jobs")
        expect(parsed).toHaveProperty("totalJobs")
      }
    })

    it("should output table format", async () => {
      const yamlContent = dedent`
        stages:
          - build
          - test

        build-job:
          stage: build
          script:
            - echo "Building..."

        test-job:
          stage: test
          script:
            - echo "Testing..."
      `

      const yamlPath = join(TEST_DIR, "table-format.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-f", "table"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("build-job", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

         Status | Job       | Stage | When
        --------+-----------+-------+------------
           ✓    | build-job | build | on_success
           ✓    | test-job  | test  | on_success
        "
      `)
    })
  })

  describe("Branch-based Rules", () => {
    it("should simulate with branch variable", async () => {
      const yamlContent = dedent`
        stages:
          - build
          - deploy

        build-main:
          stage: build
          script:
            - echo "Building for main..."
          rules:
            - if: $CI_COMMIT_BRANCH == "main"

        build-develop:
          stage: build
          script:
            - echo "Building for develop..."
          rules:
            - if: $CI_COMMIT_BRANCH == "develop"

        deploy:
          stage: deploy
          script:
            - echo "Deploying..."
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
      `

      const yamlPath = join(TEST_DIR, "branch-rules.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      // Simulate on main branch
      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-b", "main"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const mainOutput = cleanOutput(await session.text())

      expect(mainOutput).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    3
        Will Run:      2
          - Automatic: 2
          - Manual:    0
        Will Skip:     1

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)
          deploy: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ build-main (build)
          ▶ deploy (deploy)
        "
      `)

      session.close()

      // Simulate on develop branch
      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-b", "develop"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const developOutput = cleanOutput(await session.text())

      expect(developOutput).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    3
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     2

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)
          deploy: 0 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ build-develop (build)
        "
      `)
    })

    it("should simulate with custom variables", async () => {
      const yamlContent = dedent`
        stages:
          - build

        build-enabled:
          stage: build
          script:
            - echo "Building..."
          rules:
            - if: $BUILD_ENABLED == "true"

        build-disabled:
          stage: build
          script:
            - echo "This should not run..."
          rules:
            - if: $BUILD_ENABLED == "false"
      `

      const yamlPath = join(TEST_DIR, "custom-vars.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-v", "BUILD_ENABLED=true"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    2
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     1

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ build-enabled (build)
        "
      `)
    })

    it("should simulate merge request pipeline", async () => {
      const yamlContent = dedent`
        stages:
          - test

        mr-only-job:
          stage: test
          script:
            - echo "MR tests..."
          rules:
            - if: $CI_MERGE_REQUEST_ID
      `

      const yamlPath = join(TEST_DIR, "mr-pipeline.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "--mr"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    1
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     0

        📋 Stages:
        ────────────────────────────────────────────────────────────
          test: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ mr-only-job (test)
        "
      `)
    })
  })

  describe("Output Options", () => {
    it("should show skipped jobs with --show-skipped flag", async () => {
      const yamlContent = dedent`
        stages:
          - build

        build-main:
          stage: build
          script:
            - echo "Building..."
          rules:
            - if: $CI_COMMIT_BRANCH == "main"

        build-other:
          stage: build
          script:
            - echo "Other build..."
          rules:
            - if: $CI_COMMIT_BRANCH == "other"
      `

      const yamlPath = join(TEST_DIR, "show-skipped.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-b", "main", "--show-skipped"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Skipped Jobs", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    2
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     1

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ build-main (build)

        ⏭  Skipped Jobs:
          ⊘ build-other (build)
        "
      `)
    })

    it("should show verbose output with rule evaluation", async () => {
      const yamlContent = dedent`
        stages:
          - build

        build-job:
          stage: build
          script:
            - echo "Building..."
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
              when: always
      `

      const yamlPath = join(TEST_DIR, "verbose.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-b", "main", "--verbose"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    1
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     0

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ build-job (build)
        "
      `)
    })
  })

  describe("Complex Scenarios", () => {
    it("should handle manual jobs", async () => {
      const yamlContent = dedent`
        stages:
          - deploy

        deploy-prod:
          stage: deploy
          script:
            - echo "Deploying to production..."
          rules:
            - if: $CI_COMMIT_BRANCH == "main"
              when: manual
      `

      const yamlPath = join(TEST_DIR, "manual-job.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-b", "main"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    1
        Will Run:      1
          - Automatic: 0
          - Manual:    1
        Will Skip:     0

        📋 Stages:
        ────────────────────────────────────────────────────────────
          deploy: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ⏸ deploy-prod [MANUAL] (deploy)
        "
      `)
    })

    it("should handle regex patterns in rules", async () => {
      const yamlContent = dedent`
        stages:
          - build

        feature-build:
          stage: build
          script:
            - echo "Feature build..."
          rules:
            - if: $CI_COMMIT_BRANCH =~ /^feature-.+/
      `

      const yamlPath = join(TEST_DIR, "regex-rules.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-b", "feature-new-ui"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    1
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     0

        📋 Stages:
        ────────────────────────────────────────────────────────────
          build: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ feature-build (build)
        "
      `)
    })

    it("should handle tag-based pipelines", async () => {
      const yamlContent = dedent`
        stages:
          - release

        release-job:
          stage: release
          script:
            - echo "Creating release..."
          rules:
            - if: $CI_COMMIT_TAG
      `

      const yamlPath = join(TEST_DIR, "tag-pipeline.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "--tag", "v1.0.0"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Pipeline Simulation Result", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "

        📊 Pipeline Simulation Result

        ════════════════════════════════════════════════════════════
        Total Jobs:    1
        Will Run:      1
          - Automatic: 1
          - Manual:    0
        Will Skip:     0

        📋 Stages:
        ────────────────────────────────────────────────────────────
          release: 1 job(s)

        🔧 Jobs:
        ────────────────────────────────────────────────────────────
          ▶ release-job (release)
        "
      `)
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid YAML gracefully", async () => {
      const invalidYaml = dedent`
        stages:
          - build
        invalid yaml content [[[
      `

      const yamlPath = join(TEST_DIR, "invalid.yml")
      await writeFile(yamlPath, invalidYaml, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Error", { timeout: 5000 })

      const output = await session.text()
      expect(output).toContain("Error")
    })

    it("should handle invalid format option", async () => {
      const yamlContent = dedent`
        stages:
          - build

        build-job:
          stage: build
          script:
            - echo "Building..."
      `

      const yamlPath = join(TEST_DIR, "invalid-format.yml")
      await writeFile(yamlPath, yamlContent, "utf-8")

      session = await launchTerminal({
        command: "node",
        args: [CLI_PATH, "simulate", yamlPath, "-f", "invalid-format"],
        cols: 120,
        rows: 30,
      })

      await session.waitForText("Invalid format", { timeout: 5000 })

      const output = cleanOutput(await session.text())

      expect(output).toMatchInlineSnapshot(`
        "
        Invalid format: invalid-format. Must be one of: text, json, yaml, table, summary
        "
      `)
    })
  })
})
