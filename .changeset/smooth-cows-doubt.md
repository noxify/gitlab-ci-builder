---
"@noxify/gitlab-ci-builder": minor
---

Added pipeline simulation feature to evaluate which jobs will run based on variables and rules

- Added `simulate` CLI command to simulate GitLab CI pipeline execution
- Added `PipelineSimulator` class for rule evaluation and job filtering
- Support for branch, tag, and merge request pipeline simulation
- Multiple output formats: summary, table, JSON, YAML, and text
- Comprehensive integration and E2E test coverage
