---
"@noxify/gitlab-ci-builder": minor
---

Add support for default export in `dynamicInclude`. Config modules can now use either `export default function(config: Config)` or the existing `export function extendConfig(config: Config)`. Default export is preferred when both are present.
