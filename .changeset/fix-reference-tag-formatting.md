---
"@noxify/gitlab-ci-builder": patch
---

Fixed YAML serialization of `!reference` tags to output inline format without quotes, enabling proper GitLab CI reference resolution.
