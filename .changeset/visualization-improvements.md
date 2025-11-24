---
"@noxify/gitlab-ci-builder": minor
---

Improve visualization rendering with professional libraries

- Replace custom ASCII tree rendering with `oo-ascii-tree` for better box-drawing characters
- Replace custom table rendering with `climt` for professional CLI tables
  - Change table layout from horizontal to vertical (Stage | Job columns)
  - Display one job per row with full ext ends chains
