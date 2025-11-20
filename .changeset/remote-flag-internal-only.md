---
"@noxify/gitlab-ci-builder": patch
---

Fix: remote flag is now internal-only

- The `remote` option for jobs/templates is now used only for merge logic and is stripped from the final YAML output.
- Prevents leaking internal flags into exported pipeline definitions.
