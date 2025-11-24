---
"@noxify/gitlab-ci-builder": minor
---

Fluent Job Builder API

**New Feature: Fluent Job Builder API**

Added a powerful fluent builder interface for defining jobs and templates with chainable methods:

**New Methods:**

- `addJob(name)` - Create a new job with fluent builder interface
- `addTemplate(name)` - Create a new template with fluent builder interface

**JobBuilder Methods:**
Common properties:

- `stage(stage)` - Set job stage
- `extends(extend)` - Set extends
- `image(image)` - Set image
- `script(script)` - Set script
- `beforeScript(script)` - Set before_script
- `afterScript(script)` - Set after_script
- `services(services)` - Set services
- `cache(cache)` - Set cache
- `artifacts(artifacts)` - Set artifacts
- `setVariables(vars)` - Set job variables
- `environment(env)` - Set environment
- `when(when)` - Set when condition
- `rules(rules)` - Set rules
- `needs(needs)` - Set needs
- `tags(tags)` - Set tags
- `allowFailure(bool)` - Set allow_failure
- `timeout(timeout)` - Set timeout
- `retry(retry)` - Set retry
- `parallel(parallel)` - Set parallel
- `trigger(trigger)` - Set trigger
- `coverage(pattern)` - Set coverage pattern
- `dependencies(deps)` - Set dependencies
- `resourceGroup(group)` - Set resource_group
- `release(release)` - Set release
- `interruptible(bool)` - Set interruptible
- `idTokens(tokens)` - Set id_tokens

Utility methods:

- `set(props)` - Bulk set multiple properties at once
- `jobOptions(opts)` - Set job options (remote, mergeExtends, etc.)
- `remote(bool)` - Mark job as remote
- `mergeExtends(bool)` - Control extends merging
- `resolveTemplatesOnly(bool)` - Control template resolution
- `done()` - Finalize job and return to ConfigBuilder

**Auto-Return Behavior:**
When you call `addJob()` or `addTemplate()` from a JobBuilder, the previous job is automatically saved and a new builder is returned:

```typescript
const config = new ConfigBuilder()

// Fluent API with auto-return
config
  .stages("build", "test", "deploy")
  .addTemplate(".node")
  .image("node:20")
  .cache({ paths: ["node_modules/"] })
  .addJob("test")
  .stage("test")
  .extends(".node")
  .script(["npm test"])
  .addJob("build")
  .stage("build")
  .extends(".node")
  .script(["npm run build"])
  .addJob("deploy")
  .stage("deploy")
  .extends("build")
  .script(["kubectl apply -f k8s/"])
  .when("manual")
  .done()

// Or use done() to explicitly return to ConfigBuilder
config
  .addJob("lint")
  .stage("test")
  .script(["npm run lint"])
  .done()
  .addJob("format")
  .stage("test")
  .script(["npm run format:check"])
  .done()

// Bulk property updates with set()
config
  .addJob("complex")
  .set({
    stage: "test",
    image: "node:20",
    script: ["npm test"],
    cache: { paths: ["node_modules/"] },
    artifacts: { paths: ["coverage/"] },
  })
  .done()
```

**Benefits:**

- **Type-safe**: Full TypeScript support with autocomplete
- **Readable**: Clear, declarative pipeline definitions
- **Flexible**: Mix with existing `job()` and `template()` methods
- **Convenient**: Auto-return behavior reduces boilerplate
- **Powerful**: All job properties supported with dedicated methods

This fluent API is especially useful for complex pipelines with many jobs, making the code more maintainable and easier to read.
