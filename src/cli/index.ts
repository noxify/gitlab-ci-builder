#!/sr/bin/env node
import { Command } from "@commander-js/extra-typings"
import { readPackage } from "read-pkg"

import simulateCommand from "./commands/simulate"
import visualizeCommand from "./commands/visualize"

async function main() {
  const pkg = await readPackage()

  const program = new Command()
    .name("gitlab-ci-builder")
    .description("GitLab CI Pipeline Builder and Visualizer")
    .addCommand(visualizeCommand())
    .addCommand(simulateCommand())

    .version(pkg.version)

  await program.parseAsync()
}

;(async () => {
  try {
    await main()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
})()
