---
"@noxify/gitlab-ci-builder": patch
---

Improved internal code quality and security:

- Eliminated lint suppressions through code refactoring (expression-complexity, no-unnecessary-condition)
- Unified import style to `node:path` default import
- Added named capture groups to regex patterns
- Reduced cyclomatic complexity in YAML serializer
- Updated security overrides for transitive dependencies (shell-quote, ws, vite, brace-expansion, js-yaml, hono, esbuild)
