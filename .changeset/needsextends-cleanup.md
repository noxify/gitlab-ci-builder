---
"@noxify/gitlab-ci-builder": patch
---

ensure `needsExtends` is always removed from final output

Previously `needsExtends` (internal merge-order metadata) was only deleted in certain branches of the cleanup logic, causing it to leak into the final YAML when a job had a single remote `extends` reference. Now it's unconditionally removed from all jobs during serialization.
