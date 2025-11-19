---
"@noxify/gitlab-ci-builder": patch
---

Fix regression in YAML import script formatting where multi-line simple script blocks produced a nested array structure (`script: [[...]]`) instead of a flat array (`script: [ ... ]`).

The importer now flattens multi-line simple commands correctly and preserves template literals only when shell operators (pipes, heredoc, redirects, continuations) are present.
