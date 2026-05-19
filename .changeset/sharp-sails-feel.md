---
"@noxify/gitlab-ci-builder": patch
---

This patch improves stability and maintainability after the dependency update and lint cleanup.

- Updated all dependencies to their latest version to fix open vulnerabilities
- Migrated from eslint and prettier to oxlint and oxfmt
- Refactored include and extends resolution internals to reduce complexity and improve readability, without changing the public API behavior.
- Removed circular import chains (`import/no-cycle`) by switching selected cross-module dependencies to safer direct imports and dynamic imports where needed.
- Reduced barrel-file usage in internal modules by migrating many imports to direct file-level paths and removing unnecessary re-export indirection.
- Updated simulation-related module wiring (including direct simulation exports) and aligned related CLI/test imports.
- Modernized parts of the Vitest mocking setup (including hoisted mocks in targeted tests) and adjusted tests accordingly.
- Fixed multiple lint-driven edge cases discovered during the cleanup (complexity, type hygiene, and consistency issues), resulting in a more predictable codebase for future changes.

Note: This release primarily contains internal refactors and test/tooling alignment. User-facing behavior should remain compatible, aside from minor CLI output formatting/snapshot alignment where tests were updated.
