import { readFile } from "node:fs/promises"

import { Command } from "@commander-js/extra-typings"

import type { VisualizationFormat } from "../../resolution/visualization"
import { visualizeYaml } from "../../resolution/visualization"

export default function visualizeCommand() {
  const program = new Command()

  program
    .name("visualize")
    .description("Visualize GitLab CI pipeline structure and dependencies")
    .argument("<path-or-url>", "Path to .gitlab-ci.yml file or remote URL")
    .option(
      "-f, --format <format>",
      "Output format: mermaid, ascii, table, all",
      "all"
    )
    .option("--show-stages", "Show stage information", true)
    .option("--show-remotes", "Show remote template sources", true)
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
  $ gitlab-ci-builder visualize .gitlab-ci.yml
  $ gitlab-ci-builder visualize https://gitlab.com/my-org/my-project/-/raw/main/.gitlab-ci.yml -t <token>
  $ gitlab-ci-builder visualize https://example.com/.gitlab-ci.yml -f mermaid
  $ GITLAB_TOKEN=<token> gitlab-ci-builder visualize https://gitlab.com/private/.gitlab-ci.yml
  $ gitlab-ci-builder visualize pipeline.yml --host gitlab.company.com -t <token>
  $ gitlab-ci-builder visualize pipeline.yml -f ascii
`
    )
    .action(async (input, options) => {
      const format = options.format as VisualizationFormat

      if (!["mermaid", "ascii", "table", "all"].includes(format)) {
        // eslint-disable-next-line no-console
        console.error(
          `Invalid format: ${format}. Must be one of: mermaid, ascii, table, all`
        )
        process.exit(1)
      }

      try {
        let yamlContent: string

        // Get token and host from CLI option or environment variable
        const token = options.token ?? process.env.GITLAB_TOKEN
        const host =
          // oxlint-disable-next-line unicorn/no-negated-condition
          options.host !== "gitlab.com"
            ? options.host
            : (process.env.GITLAB_HOST ?? "gitlab.com")
        const gitlabUrl =
          host === "gitlab.com" ? "https://gitlab.com" : `https://${host}`

        // Check if it's a URL
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
          // Local YAML file
          yamlContent = await readFile(input, "utf-8")
        }

        const result = await visualizeYaml(yamlContent, {
          format,
          showStages: options.showStages,
          showRemotes: options.showRemotes,
          gitlabToken: token,
          gitlabUrl,
        })

        // Print results
        if (result.mermaid) {
          // eslint-disable-next-line no-console
          console.log("\n=== Mermaid Diagram ===\n")
          // eslint-disable-next-line no-console
          console.log(result.mermaid)
        }

        if (result.ascii) {
          // eslint-disable-next-line no-console
          console.log("\n=== ASCII Tree ===\n")
          // eslint-disable-next-line no-console
          console.log(result.ascii)
        }

        if (result.table) {
          // eslint-disable-next-line no-console
          console.log("\n=== Stage Table ===\n")
          // eslint-disable-next-line no-console
          console.log(result.table)
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error:", error)
        process.exit(1)
      }
    })

  return program
}
