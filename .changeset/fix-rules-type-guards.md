---
"@noxify/gitlab-ci-builder": minor
---

Add comprehensive test infrastructure for GitLab CI templates with local YAML storage and improve type safety for rules array access

- Add test helper utilities for GitLab template round-trip testing
- Add 22 official GitLab CI templates as local test fixtures
- Add integration tests for language templates (19 tests)
- Add integration tests for infrastructure templates (3 tests)
- Add integration tests for browser performance artifacts (2 tests)
- Add support for `spec` with `inputs` (GitLab CI/CD components)
- Add integration tests for multi-document YAML with OpenTofu component
- Add interpolation support for schema fields that can contain GitLab CI/CD variables
- Fix TypeScript type errors in test assertions for rules array access by adding proper type guards
- Remove 'pages' from reserved job names (it's a valid GitLab Pages job name)
- Reorganize tests into unit and integration directories
