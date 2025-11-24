---
"@noxify/gitlab-ci-builder": patch
---

Fixed extends resolution behavior with `resolveTemplatesOnly: true`

Previously, when `resolveTemplatesOnly: true` was set (the default), ALL extends were removed after merging, including normal jobs and remote references that should have been preserved.

**Old behavior (incorrect):**

- Templates (`.prefix`) were merged ✅
- Normal jobs (without `.`) were merged ❌ (should stay in extends)
- Remote jobs were merged ❌ (should stay in extends)
- Unknown/external jobs were merged ❌ (should stay in extends)

**New behavior (correct):**

- Templates (`.prefix`) are merged ✅
- Normal jobs (without `.`) remain in extends ✅
- Remote jobs remain in extends ✅
- Unknown/external jobs remain in extends ✅

This fix enables proper GitLab CI template composition patterns, particularly for shallow jobs that use `remote: true` to reference jobs from other configurations without merging them.
