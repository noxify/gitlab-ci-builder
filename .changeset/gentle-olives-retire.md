---
"@noxify/gitlab-ci-builder": patch
---

Add support for `artifacts.reports.dotenv` property with `string | string[]` type. Import now intelligently normalizes single-element arrays to strings for cleaner generated code.
