---
"@noxify/gitlab-ci-builder": patch
---

Change `dynamicInclude` config functions to return the `Config` instance for consistency with the fluent builder pattern.

Included config files should now return the config:

```ts
export default function (config: Config) {
  config.stages("build")
  return config
}
```
