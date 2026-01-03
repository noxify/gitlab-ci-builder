---
"@noxify/gitlab-ci-builder": minor
---

Added pipeline simulation feature and improved remote extends handling

**Simulation Features:**

- Added `simulate` CLI command to simulate GitLab CI pipeline execution
- Added `PipelineSimulator` class for rule evaluation and job filtering
- Support for branch, tag, and merge request pipeline simulation
- Multiple output formats: summary, table, JSON, YAML, and text
- Predefined CI variables automatically set based on context
- Comprehensive integration and E2E test coverage

**Remote Extends Improvements:**

- Added `mergeRemoteExtends` global option to control remote extends resolution
- Fixed remote extends resolution for accurate pipeline simulation
- Better handling of remote includes and templates

**Documentation & Testing:**

- Enhanced CLI documentation with predefined variables table
- Added error handling documentation for remote includes
- Added "Common Pitfalls & Best Practices" section
- Improved JSDoc coverage for all public APIs
