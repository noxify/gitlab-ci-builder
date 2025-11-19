---
"@noxify/gitlab-ci-builder": patch
---

Improve YAML anchor handling by filtering out anchor definitions that don't contain valid job objects. This prevents type errors when importing GitLab CI files with pure anchor arrays.
