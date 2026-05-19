import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { Command } from "@commander-js/extra-typings"
import { ClimtTable } from "climt"
import { dump as yamlDump } from "js-yaml"

import { ConfigBuilder } from "../../builder/config-builder"
import { parseYaml } from "../../importer/parser"
import { resolveIncludes } from "../../resolver/cli"
import type { IncludeInput } from "../../schema/include"
import type { Workflow } from "../../schema/workflow"
import type { SimulationResult } from "../../simulation/pipeline-simulator"
import { PipelineSimulator } from "../../simulation/pipeline-simulator"
import type { RuleContext } from "../../simulation/rule-evaluator"

interface SimulateOptions {
  format: string
  variable?: string[]
  branch?: string
  tag?: string
  mr?: boolean
  mrLabels?: string[]
  showSkipped: boolean
  verbose: boolean
  token?: string
  host: string
}

export default function simulateCommand() {
  const program = new Command()

  program
    .name("simulate")
    .description(
      "Simulate GitLab CI pipeline execution based on variables and rules"
    )
    .argument("<path-or-url>", "Path to .gitlab-ci.yml file or remote URL")
    .option(
      "-v, --variable <key=value...>",
      "Set pipeline variables (can be used multiple times)"
    )
    .option("-b, --branch <branch>", "Simulate for specific branch")
    .option("--tag <tag>", "Simulate for specific tag")
    .option("--mr", "Simulate merge request pipeline")
    .option("--mr-labels <labels...>", "Merge request labels (comma-separated)")
    .option(
      "-f, --format <format>",
      "Output format: text, json, yaml, table, summary",
      "summary"
    )
    .option("--show-skipped", "Show skipped jobs in output", false)
    .option("--verbose", "Verbose output with detailed rule evaluation", false)
    .option(
      "-t, --token <token>",
      "Authentication token for private repositories (or use GITLAB_TOKEN env var)"
    )
    .option(
      "--host <host>",
      "GitLab host for project/template includes (or use GITLAB_HOST env var)",
      "gitlab.com"
    )
    .addHelpText(
      "after",
      `
Examples:
  $ gitlab-ci-builder simulate .gitlab-ci.yml -b main
  $ gitlab-ci-builder simulate .gitlab-ci.yml -v CI_COMMIT_BRANCH=main -v JOB_DISABLED=true
  $ gitlab-ci-builder simulate pipeline.yml --branch develop --mr
  $ gitlab-ci-builder simulate .gitlab-ci.yml -f table --show-skipped
  $ gitlab-ci-builder simulate https://gitlab.com/org/repo/-/raw/main/.gitlab-ci.yml -t <token>
  $ gitlab-ci-builder simulate .gitlab-ci.yml -f json > simulation.json
`
    )
    .action(async (input, options) => {
      const format = options.format as
        | "text"
        | "json"
        | "yaml"
        | "table"
        | "summary"
      if (!isValidFormat(format)) {
        // eslint-disable-next-line no-console
        console.error(
          `Invalid format: ${format}. Must be one of: text, json, yaml, table, summary`
        )
        process.exit(1)
      }
      try {
        const {
          yamlContent,
          basePath,
          token,
          host: _host,
          gitlabUrl,
        } = await getInputContext(input, options)
        const variables = parseVariables(options)
        addBranchAndTagVariables(variables, options)
        addDefaultVariables(variables, options)
        if (options.mr) {
          variables.CI_MERGE_REQUEST_ID = "1"
          variables.CI_PIPELINE_SOURCE = "merge_request_event"
        }
        const mrLabels = options.mrLabels
          ? options.mrLabels.flatMap((label: string) =>
              label.split(",").map((l) => l.trim())
            )
          : undefined
        const context: RuleContext = {
          variables,
          branch: options.branch,
          tag: options.tag,
          mergeRequestLabels: mrLabels,
          basePath,
        }
        const { config, parsed } = buildConfigFromYaml(yamlContent)
        let failedIncludes: string[] = []
        if (parsed.include) {
          const result = await resolveIncludes(config, {
            resolveReferences: true,
            basePath: process.cwd(),
            gitlabToken: token,
            gitlabUrl,
            verbose: options.verbose,
          })
          failedIncludes = result.failedIncludes || []
        }
        const simulator = new PipelineSimulator()
        const result: SimulationResult = simulator.simulate(config, context)
        if (failedIncludes.length > 0) {
          printFailedIncludes(failedIncludes)
        }
        printSimulationResult(format, result, options)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error:", error)
        process.exit(1)
      }
    })

  return program
}

function isValidFormat(format: string): boolean {
  return ["text", "json", "yaml", "table", "summary"].includes(format)
}

async function getInputContext(input: string, options: SimulateOptions) {
  const token = options.token ?? process.env.GITLAB_TOKEN
  const host =
    // oxlint-disable-next-line unicorn/no-negated-condition
    options.host !== "gitlab.com"
      ? options.host
      : (process.env.GITLAB_HOST ?? "gitlab.com")
  const gitlabUrl =
    host === "gitlab.com" ? "https://gitlab.com" : `https://${host}`
  let yamlContent: string
  let basePath: string | undefined
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    const response = await fetch(input, { headers })
    if (!response.ok) {
      throw new Error(`Failed to fetch ${input}: ${response.statusText}`)
    }
    yamlContent = await response.text()
  } else {
    yamlContent = await readFile(input, "utf-8")
    basePath = dirname(resolve(process.cwd(), input))
  }
  return { yamlContent, basePath, token, host, gitlabUrl }
}

function parseVariables(options: SimulateOptions): Record<string, string> {
  const variables: Record<string, string> = {}
  if (options.variable) {
    for (const varOption of options.variable) {
      const [key, ...valueParts] = varOption.split("=")
      if (key) {
        variables[key] = valueParts.join("=") || ""
      }
    }
  }
  return variables
}

function addBranchAndTagVariables(
  variables: Record<string, string>,
  options: SimulateOptions
) {
  if (options.branch) {
    variables.CI_COMMIT_BRANCH = options.branch
    if (!variables.CI_DEFAULT_BRANCH) {
      variables.CI_DEFAULT_BRANCH = options.branch
    }
    if (!variables.CI_COMMIT_REF_NAME) {
      variables.CI_COMMIT_REF_NAME = options.branch
    }
    if (!variables.CI_COMMIT_REF_SLUG) {
      variables.CI_COMMIT_REF_SLUG = options.branch
        .toLowerCase()
        .replaceAll(/[^a-z0-9-]/gu, "-")
    }
  }
  if (options.tag) {
    variables.CI_COMMIT_TAG = options.tag
    if (!variables.CI_COMMIT_REF_NAME) {
      variables.CI_COMMIT_REF_NAME = options.tag
    }
    if (!variables.CI_COMMIT_REF_SLUG) {
      variables.CI_COMMIT_REF_SLUG = options.tag
        .toLowerCase()
        .replaceAll(/[^a-z0-9-]/gu, "-")
    }
  }
}

function addDefaultVariables(
  variables: Record<string, string>,
  _options: SimulateOptions
) {
  if (!variables.CI_PIPELINE_SOURCE) {
    variables.CI_PIPELINE_SOURCE = "push"
  }
  variables.CI_COMMIT_MESSAGE ??= ""
  variables.CI_COMMIT_TITLE ??= ""
}

function buildConfigFromYaml(yamlContent: string) {
  const parsed = parseYaml(yamlContent)
  const config = new ConfigBuilder()
  if (parsed.stages) {
    config.stages(
      ...(Array.isArray(parsed.stages)
        ? (parsed.stages as string[])
        : ([parsed.stages] as string[]))
    )
  }
  if (parsed.variables && typeof parsed.variables === "object") {
    config.variables(
      parsed.variables as Record<string, string | number | boolean>
    )
  }
  if (parsed.workflow && typeof parsed.workflow === "object") {
    try {
      config.workflow(parsed.workflow as Workflow)
    } catch {
      // Ignore validation errors for simulation
    }
  }
  for (const [name, definition] of Object.entries(parsed)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      ![
        "stages",
        "variables",
        "workflow",
        "include",
        "default",
        "spec",
      ].includes(name)
    ) {
      try {
        if (name.startsWith(".")) {
          config.template(name, definition)
        } else {
          config.job(name, definition)
        }
      } catch {
        // Silently skip jobs with validation errors
        // Optionally log if needed
      }
    }
  }
  if (parsed.include) {
    config.include(parsed.include as IncludeInput | IncludeInput[])
  }
  return { config, parsed }
}

function printFailedIncludes(failedIncludes: string[]) {
  // eslint-disable-next-line no-console
  console.error("\n⚠️  WARNING: Failed to load remote includes")
  // eslint-disable-next-line no-console
  console.error("═".repeat(60))
  // eslint-disable-next-line no-console
  console.error("The following includes could not be fetched:\n")
  for (const inc of failedIncludes) {
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${inc}`)
  }
  // eslint-disable-next-line no-console
  console.error(
    "\nJobs that depend on templates from these includes may not run correctly."
  )
  // eslint-disable-next-line no-console
  console.error(
    "The simulation results may be incomplete. Consider downloading these files locally.\n"
  )
}

function printSimulationResult(
  format: string,
  result: SimulationResult,
  options: SimulateOptions
) {
  if (format === "json") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2))
  } else if (format === "yaml") {
    // eslint-disable-next-line no-console
    console.log(yamlDump(result))
  } else if (format === "table") {
    printTableOutput(result, options)
  } else {
    // summary and text (legacy)
    printSummaryOutput(result, options)
  }
}

function printSummaryOutput(
  result: SimulationResult,
  options: { showSkipped: boolean; verbose: boolean }
) {
  // eslint-disable-next-line no-console
  console.log("\n📊 Pipeline Simulation Result\n")
  // eslint-disable-next-line no-console
  console.log("═".repeat(60))

  // Job statistics
  const runningJobs = result.jobs.filter((j) => j.shouldRun)
  const skippedJobs = result.jobs.filter((j) => !j.shouldRun)
  const manualJobs = runningJobs.filter((j) => j.when === "manual")

  // eslint-disable-next-line no-console
  console.log(`Total Jobs:    ${result.totalJobs}`)
  // eslint-disable-next-line no-console
  console.log(`Will Run:      ${runningJobs.length}`)
  // eslint-disable-next-line no-console
  console.log(`  - Automatic: ${runningJobs.length - manualJobs.length}`)
  // eslint-disable-next-line no-console
  console.log(`  - Manual:    ${manualJobs.length}`)
  // eslint-disable-next-line no-console
  console.log(`Will Skip:     ${skippedJobs.length}`)
  // eslint-disable-next-line no-console
  console.log()

  // Collect stages from jobs
  const stages = [...new Set(result.jobs.map((j) => j.stage))]

  // eslint-disable-next-line no-console
  console.log("📋 Stages:")
  // eslint-disable-next-line no-console
  console.log("─".repeat(60))

  for (const stage of stages) {
    const stageJobs = runningJobs.filter((j) => j.stage === stage)
    // eslint-disable-next-line no-console
    console.log(`  ${stage}: ${stageJobs.length} job(s)`)
  }

  // eslint-disable-next-line no-console
  console.log()
  // eslint-disable-next-line no-console
  console.log("🔧 Jobs:")
  // eslint-disable-next-line no-console
  console.log("─".repeat(60))

  // Running jobs
  for (const job of runningJobs) {
    const icon = job.when === "manual" ? "⏸️" : "▶️"
    const whenInfo = job.when === "manual" ? " [MANUAL]" : ""
    // eslint-disable-next-line no-console
    console.log(`  ${icon} ${job.name}${whenInfo} (${job.stage})`)
    if (options.verbose && job.reason) {
      // eslint-disable-next-line no-console
      console.log(`     → ${job.reason}`)
    }
  }

  // Skipped jobs (if requested)
  if (options.showSkipped && skippedJobs.length > 0) {
    // eslint-disable-next-line no-console
    console.log()
    // eslint-disable-next-line no-console
    console.log("⏭️  Skipped Jobs:")
    for (const job of skippedJobs) {
      // eslint-disable-next-line no-console
      console.log(`  ⊘ ${job.name} (${job.stage})`)
      if (options.verbose && job.reason) {
        // eslint-disable-next-line no-console
        console.log(`     → ${job.reason}`)
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log()
}

function printTableOutput(
  result: SimulationResult,
  options: { verbose: boolean; showSkipped: boolean }
) {
  const table = new ClimtTable()
  table.column("Status", "status", {
    width: 8,
    maxWidth: 8,
    overflow: "truncate",
    align: "center",
  })
  table.column("Job", "name", {
    width: 0,
    maxWidth: 50,
    overflow: "truncate",
    align: "left",
  })
  table.column("Stage", "stage", {
    width: 0,
    maxWidth: 30,
    overflow: "truncate",
    align: "left",
  })
  table.column("When", "when", {
    width: 12,
    maxWidth: 12,
    overflow: "truncate",
    align: "left",
  })
  if (options.verbose) {
    table.column("Reason", "reason", {
      width: 0,
      maxWidth: 40,
      overflow: "truncate",
      align: "left",
    })
  }

  // Filter and sort jobs
  let jobs = options.showSkipped
    ? result.jobs
    : result.jobs.filter((j) => j.shouldRun)

  // Sort by stage order from config, then by name
  const stageOrder: string[] = result.stages
  jobs = jobs.toSorted((a, b) => {
    const stageIndexA: number = stageOrder.indexOf(a.stage)
    const stageIndexB: number = stageOrder.indexOf(b.stage)

    const isAInConfig = stageIndexA !== -1
    const isBInConfig = stageIndexB !== -1

    // Both stages in config: sort by config order
    if (isAInConfig && isBInConfig) {
      if (stageIndexA !== stageIndexB) {
        return stageIndexA - stageIndexB
      }
      return a.name.localeCompare(b.name)
    }

    // Only A in config: A comes first
    if (isAInConfig && !isBInConfig) {
      return -1
    }

    // Only B in config: B comes first
    if (!isAInConfig && isBInConfig) {
      return 1
    }

    // Neither in config: sort by stage name, then job name
    const stageCompare = a.stage.localeCompare(b.stage)
    if (stageCompare !== 0) {
      return stageCompare
    }
    return a.name.localeCompare(b.name)
  })

  const tableData = jobs.map((job) => ({
    status: job.shouldRun ? "✓" : "⊘",
    name: job.name,
    stage: job.stage,
    when: job.when,
    reason: options.verbose ? (job.reason ?? "") : undefined,
  }))

  table.render(tableData)
}
