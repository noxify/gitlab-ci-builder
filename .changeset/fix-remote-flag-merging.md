---
"@noxify/gitlab-ci-builder": patch
---

Fixed remote flag handling - internal properties are now stripped after extends resolution to ensure remote jobs/templates are correctly excluded from merging while preserving their references.
