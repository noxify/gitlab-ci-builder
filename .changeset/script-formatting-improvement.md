---
"@noxify/gitlab-ci-builder": patch
---

Improve script formatting in YAML import with intelligent detection of shell operators.

The import now intelligently formats `script`, `before_script`, and `after_script` properties:

- **Simple multi-line commands** → Split into string array for better readability
- **Line continuations** (`\`) → Preserved as template literals
- **Shell operators** (heredoc `<<`, pipes `|`, redirects `>`, `>>`, `2>`, `<`) → Preserved as template literals
- **Single-line commands** → Formatted as simple strings

This produces more idiomatic and readable TypeScript code while preserving shell command semantics.
