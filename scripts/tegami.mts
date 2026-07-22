import { tegami } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";

const paper = tegami({
  plugins: [
    github({
      repo: "noxify/gitlab-ci-builder",
      versionPr: {
        base: "main",
      },
    }),
  ],
});

await runCli(paper);
