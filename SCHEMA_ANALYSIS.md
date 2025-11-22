# GitLab CI Schema - Fehlende Features Analyse

Basierend auf dem offiziellen GitLab CI JSON Schema (https://gitlab.com/gitlab-org/gitlab-foss/-/raw/master/app/assets/javascripts/editor/schema/ci.json)

## ✅ Bereits implementiert

### Top-Level

- ✅ `stages` - Array of stages
- ✅ `variables` - Global variables
- ✅ `workflow` - Workflow configuration mit rules & auto_cancel
- ✅ `default` - Default configuration für alle Jobs
- ✅ `include` - Include configuration (local, remote, project, template, component)

### Jobs

- ✅ `script` - Job scripts
- ✅ `before_script` / `after_script`
- ✅ `stage` - Job stage
- ✅ `image` - Container image (string oder object mit name/entrypoint)
- ✅ `services` - Services (string oder object mit name/alias/entrypoint/command)
- ✅ `tags` - Runner tags
- ✅ `variables` - Job variables
- ✅ `rules` - Execution rules (if/when/changes/exists/allow_failure/variables)
- ✅ `extends` - Template inheritance
- ✅ `artifacts` - Artifact configuration (paths/exclude/expose_as/untracked/when/expire_in/reports)
- ✅ `cache` - Cache configuration (key/paths/untracked/when/policy)
- ✅ `needs` - Job dependencies
- ✅ `dependencies` - Artifact dependencies
- ✅ `allow_failure` - Allow job to fail (boolean oder exit_codes)
- ✅ `when` - When to run job
- ✅ `timeout` - Job timeout
- ✅ `retry` - Retry configuration (max/when/exit_codes)
- ✅ `parallel` - Parallel jobs (number oder matrix)
- ✅ `interruptible` - Job can be interrupted
- ✅ `resource_group` - Resource group
- ✅ `environment` - Environment deployment (string oder object)
- ✅ `release` - Release configuration
- ✅ `trigger` - Trigger downstream pipelines

### Include

- ✅ `local` - Local file include
- ✅ `remote` - Remote URL include
- ✅ `project` - Project include mit file/ref
- ✅ `template` - Template include
- ✅ `component` - Component include mit inputs
- ✅ `rules` - Include rules (if/changes/exists/when)

## ❌ Fehlende Features

### 1. **Top-Level: `spec` (NEU!)**

```typescript
spec: {
  inputs: {
    [key: string]: {
      type?: "string" | "number" | "boolean" | "array"
      description?: string
      options?: (string | number | boolean)[]
      regex?: string
      default?: any
      rules?: Array<{...}>
    }
  }
}
```

**Beschreibung**: Pipeline configuration inputs - ermöglicht parametrisierte CI/CD Konfigurationen
**Priorität**: 🟡 Mittel (für wiederverwendbare Konfigurationen wichtig)

### 2. **Top-Level: `!reference` Tag**

```typescript
"!reference": string[]  // Array of references
```

**Beschreibung**: YAML Reference Tag Support für alle Felder
**Status**: ⚠️ Teilweise - Wir behandeln !reference als String in Scripts, aber nicht als globales Feature
**Priorität**: 🟡 Mittel

### 3. **Top-Level: `pages` Job**

```typescript
pages: {
  // Special job with automatic Pages deployment
  path_prefix?: string
  expire_in?: string
  publish?: string
}
```

**Beschreibung**: Spezieller Job für GitLab Pages
**Priorität**: 🟢 Niedrig (Spezialfall)

### 4. **Global Defaults (Deprecated)**

Folgende Top-Level Keys sind deprecated, aber noch unterstützt:

- `image` (deprecated, use `default.image`)
- `services` (deprecated, use `default.services`)
- `before_script` (deprecated, use `default.before_script`)
- `after_script` (deprecated, use `default.after_script`)
- `cache` (deprecated, use `default.cache`)

**Status**: ❌ Nicht implementiert
**Priorität**: 🟢 Niedrig (deprecated, aber für Rückwärtskompatibilität relevant)

### 5. **Image erweiterte Optionen**

```typescript
image: {
  name: string
  entrypoint?: string[]
  docker?: {
    platform?: string
    user?: string
  }
  kubernetes?: {
    user?: string | number  // Supports UID:GID format
  }
  pull_policy?: "always" | "never" | "if-not-present" | string[]
}
```

**Status**: ⚠️ Teilweise - Wir haben name/entrypoint, aber nicht docker/kubernetes/pull_policy
**Priorität**: 🔴 Hoch (Docker/Kubernetes Runner wichtig)

### 6. **Services erweiterte Optionen**

```typescript
services: Array<{
  name: string
  alias?: string
  entrypoint?: string[]
  command?: string[]
  docker?: {
    platform?: string
    user?: string
  }
  kubernetes?: {
    user?: string | number
  }
  pull_policy?: "always" | "never" | "if-not-present" | string[]
  variables?: Record<string, any>
}>
```

**Status**: ⚠️ Teilweise - Wir haben name/alias/entrypoint/command, aber nicht docker/kubernetes/pull_policy/variables
**Priorität**: 🔴 Hoch

### 7. **Job: `id_tokens`**

```typescript
id_tokens: {
  [key: string]: {
    aud: string | string[]
  }
}
```

**Beschreibung**: JWT tokens für externe Authentication
**Priorität**: 🔴 Hoch (für Cloud-Integration wichtig)

### 8. **Job: `identity`**

```typescript
identity?: "google_cloud"
```

**Beschreibung**: Workload identity (experimental)
**Priorität**: 🟡 Mittel (experimental)

### 9. **Job: `secrets`**

```typescript
secrets: {
  [key: string]: {
    vault?: string | {
      engine: { name: string, path: string }
      path: string
      field: string
    }
    gcp_secret_manager?: {
      name: string
      version?: string | number
    }
    azure_key_vault?: {
      name: string
      version?: string
    }
    aws_secrets_manager?: string | {
      secret_id: string
      version_id?: string
      version_stage?: string
      region?: string
      role_arn?: string
      role_session_name?: string
      field?: string
    }
    file?: boolean
    token?: string
  }
}
```

**Beschreibung**: Integration mit Secret Managern (Vault, AWS, GCP, Azure)
**Priorität**: 🔴 Hoch (Security-relevant)

### 10. **Job: `hooks`**

```typescript
hooks: {
  pre_get_sources_script?: string | string[]
}
```

**Beschreibung**: Scripts die vor Git checkout laufen
**Priorität**: 🟡 Mittel

### 11. **Job: `inputs`**

```typescript
inputs: {
  [key: string]: {
    type?: "string" | "number" | "boolean" | "array"
    default: any  // Required!
    description?: string
    options?: (string | number | boolean)[]
    regex?: string
  }
}
```

**Beschreibung**: Job-spezifische Inputs (unterscheidet sich von spec.inputs - default ist required)
**Priorität**: 🟡 Mittel

### 12. **Job: `run` (Alternative zu `script`)**

```typescript
run: Array<{
  // Run a referenced step
  name: string
  step: string | {
    git?: { url: string, rev: string, dir?: string, file?: string }
    oci?: { registry: string, repository: string, tag: string, dir?: string, file?: string }
  }
  env?: Record<string, string>
  inputs?: Record<string, any>
} | {
  // Run a sequence
  run: Array<...>
  env?: Record<string, string>
  outputs?: Record<string, any>
  delegate?: string
} | {
  // Run an action
  name: string
  action: string
  env?: Record<string, string>
  inputs?: Record<string, any>
} | {
  // Run a script
  name: string
  script: string
  env?: Record<string, string>
} | {
  // Exec a binary
  exec: { command: string[], work_dir?: string }
  env?: Record<string, string>
}>
```

**Beschreibung**: Neues modulares Step-System (Alternative zu script)
**Priorität**: 🟡 Mittel (Neueres Feature)

### 13. **Job: `inherit`**

```typescript
inherit: {
  default?: boolean | string[]  // Which defaults to inherit
  variables?: boolean | string[] // Which variables to inherit
}
```

**Beschreibung**: Kontrolle über Vererbung von Defaults und Variables
**Priorität**: 🔴 Hoch (wichtig für komplexe Pipelines)

### 14. **Job: `pages` (spezielle Pages-Config)**

```typescript
pages: boolean | {
  path_prefix?: string
  expire_in?: string
  publish?: string
}
```

**Beschreibung**: Pages-spezifische Job-Konfiguration
**Priorität**: 🟢 Niedrig

### 15. **Job: `manual_confirmation`**

```typescript
manual_confirmation?: string
```

**Beschreibung**: Custom confirmation message für manuelle Jobs
**Priorität**: 🟢 Niedrig

### 16. **Job: `publish` (Deprecated)**

```typescript
publish?: string
```

**Beschreibung**: Deprecated - use `pages.publish` instead
**Priorität**: 🟢 Niedrig

### 17. **Defaults: `id_tokens`**

```typescript
default: {
  id_tokens?: { [key: string]: { aud: string | string[] } }
  identity?: "google_cloud"
}
```

**Beschreibung**: Default id_tokens und identity für alle Jobs
**Priorität**: 🔴 Hoch

### 18. **Defaults: `hooks`**

```typescript
default: {
  hooks?: {
    pre_get_sources_script?: string | string[]
  }
}
```

**Priorität**: 🟡 Mittel

### 19. **Cache: erweiterte Optionen**

```typescript
cache: {
  key?: string | {
    files?: string[]
    files_commits?: string[]  // NEU!
    prefix?: string
  }
  paths?: string[]
  untracked?: boolean
  when?: "on_success" | "on_failure" | "always"
  policy?: "pull" | "push" | "pull-push"
  unprotect?: boolean  // NEU!
  fallback_keys?: string[]  // NEU! (max 5)
}
```

**Status**: ⚠️ Teilweise - Wir haben nicht: files_commits, unprotect, fallback_keys
**Priorität**: 🔴 Hoch (fallback_keys sehr nützlich)

### 20. **Artifacts: `access`**

```typescript
artifacts: {
  access?: "none" | "developer" | "all"  // Default: "all"
}
```

**Beschreibung**: Kontrolle wer auf Artifacts zugreifen kann
**Priorität**: 🔴 Hoch (Security)

### 21. **Artifacts Reports: erweiterte Typen**

Zusätzliche Report-Typen:

- ✅ `junit`, `codequality`, `sast`, `dependency_scanning`, `container_scanning`, `dast`
- ❌ `accessibility` - Accessibility report
- ❌ `annotations` - Annotations report
- ❌ `browser_performance` - Browser performance metrics
- ❌ `coverage_report` - Coverage mit format (cobertura/jacoco)
- ❌ `lsif` - Code intelligence (Language Server Index Format)
- ❌ `license_management` (deprecated) / `license_scanning`
- ❌ `requirements` - Requirements report
- ❌ `secret_detection` - Secret detection
- ❌ `metrics` - Custom metrics
- ❌ `terraform` - Terraform plans
- ❌ `cyclonedx` - CycloneDX SBOM
- ❌ `load_performance` - Load performance testing
- ❌ `repository_xray` - Repository X-Ray

**Priorität**: 🟡 Mittel (spezielle Report-Typen)

### 22. **Needs: erweiterte Optionen**

```typescript
needs: Array<
  string |
  { job: string, artifacts?: boolean, optional?: boolean, parallel?: { matrix: [...] } } |
  { job: string, pipeline: string, artifacts?: boolean, parallel?: { matrix: [...] } } |
  { job: string, project: string, ref: string, artifacts?: boolean, parallel?: { matrix: [...] } }
>
```

**Status**: ⚠️ Teilweise - Wir haben job/artifacts/optional, aber nicht pipeline/project/ref/parallel
**Priorität**: 🔴 Hoch (parallel matrix sehr nützlich)

### 23. **Rules: erweiterte Optionen**

```typescript
rules: Array<{
  if?: string
  changes?: string | string[] | {
    paths: string[]
    compare_to?: string  // NEU!
  }
  exists?: string[] | {
    paths: string[]
    project?: string  // NEU!
    ref?: string  // NEU!
  }
  when?: ...
  allow_failure?: boolean | { exit_codes: number | number[] }
  variables?: Record<string, any>
  start_in?: string
  needs?: Array<...>  // NEU!
  interruptible?: boolean  // NEU!
}>
```

**Status**: ⚠️ Teilweise - Wir haben nicht: changes.compare_to, exists.project/ref, needs, interruptible in rules
**Priorität**: 🔴 Hoch

### 24. **Workflow Rules: erweiterte Optionen**

```typescript
workflow: {
  rules: Array<{
    if?: string
    changes?: ...
    exists?: ...
    variables?: Record<string, any>
    when?: "always" | "never"  // Nur diese 2 Werte!
    auto_cancel?: { on_new_commit?: ..., on_job_failure?: ... }  // NEU!
  }>
}
```

**Status**: ⚠️ Teilweise - auto_cancel in rules fehlt
**Priorität**: 🟡 Mittel

### 25. **Include: `inputs`**

```typescript
include: Array<{
  local?: string
  inputs?: Record<string, any>  // Für parametrisierte Includes
  rules?: ...
}>
```

**Status**: ⚠️ Teilweise - Wir haben inputs nur bei component, nicht bei allen Include-Typen
**Priorität**: 🔴 Hoch (wichtig für parametrisierte Konfigurationen)

### 26. **Include: `integrity` für remote**

```typescript
include: Array<{
  remote: string
  integrity?: string // SHA256 hash: "sha256-[A-Za-z0-9+/]{43}=$"
}>
```

**Beschreibung**: SHA256 Integrity Check für remote includes
**Priorität**: 🔴 Hoch (Security)

### 27. **Variables: erweiterte Definition**

```typescript
// Global variables
variables: {
  [key: string]: string | number | boolean | {
    value: string
    options?: string[]  // Predefined values für UI
    description?: string  // Explanation für UI
    expand?: boolean  // Whether variable is expandable
  }
}

// Job variables
variables: {
  [key: string]: string | number | boolean | {
    value: string
    expand?: boolean
  }
}
```

**Status**: ❌ Nicht implementiert - Wir unterstützen nur primitive Werte
**Priorität**: 🔴 Hoch (für Pipeline-UI wichtig)

### 28. **Environment: erweiterte Optionen**

```typescript
environment: {
  name: string
  url?: string
  on_stop?: string
  auto_stop_in?: string
  deployment_tier?: string
  action?: "start" | "prepare" | "stop" | "verify" | "access"  // NEU!
  kubernetes?: {
    agent?: string  // NEU! Format: "path/to/agent/project:agent-name"
    namespace?: string  // Deprecated - use dashboard.namespace
    flux_resource_path?: string  // Deprecated
    managed_resources?: {
      enabled?: boolean
    }
    dashboard?: {
      namespace?: string
      flux_resource_path?: string
    }
  }
}
```

**Status**: ⚠️ Teilweise - Wir haben nicht: action, kubernetes
**Priorität**: 🔴 Hoch (für Kubernetes-Deployments wichtig)

### 29. **Release: `assets` erweitert**

```typescript
release: {
  tag_name: string
  tag_message?: string  // NEU!
  description: string
  name?: string
  ref?: string
  milestones?: string[]
  released_at?: string  // ISO 8601 date-time
  assets?: {
    links: Array<{
      name: string
      url: string
      filepath?: string
      link_type?: "runbook" | "package" | "image" | "other"
    }>
  }
}
```

**Status**: ⚠️ Teilweise - Wir haben nur tag_name/description, fehlt: tag_message, name, ref, milestones, released_at, assets
**Priorität**: 🟡 Mittel

### 30. **Trigger: `forward` Option**

```typescript
trigger: {
  project: string
  branch?: string
  strategy?: "depend" | "mirror"
  inputs?: Record<string, any>
  forward?: {
    yaml_variables?: boolean  // Default: true
    pipeline_variables?: boolean  // Default: false
  }
}
```

**Status**: ⚠️ Teilweise - Wir haben nicht: forward
**Priorität**: 🟡 Mittel

### 31. **Trigger: Child Pipeline erweitert**

```typescript
trigger: {
  include: string | Array<{
    local?: string
    template?: string
    artifact?: string
    job?: string
    project?: string
    ref?: string
    file?: string
    component?: string
    remote?: string
    inputs?: Record<string, any>
  }>
  strategy?: "depend" | "mirror"
  forward?: {
    yaml_variables?: boolean
    pipeline_variables?: boolean
  }
}
```

**Status**: ⚠️ Teilweise - Unser trigger ist vereinfacht
**Priorität**: 🔴 Hoch

### 32. **Only/Except (Legacy, aber noch supported)**

```typescript
only?: {
  refs?: string[]
  kubernetes?: "active"
  variables?: string[]
  changes?: string[]
}
except?: {
  refs?: string[]
  kubernetes?: "active"
  variables?: string[]
  changes?: string[]
}
```

**Beschreibung**: Legacy Filter (deprecated, use rules instead)
**Status**: ❌ Nicht implementiert
**Priorität**: 🟡 Mittel (für Legacy-Kompatibilität)

### 33. **Coverage**

```typescript
coverage?: string  // Regex pattern: "/Code coverage: \\d+\\.\\d+/"
```

**Beschreibung**: Regex zum Extrahieren von Coverage aus Job-Output
**Status**: ❌ Nicht implementiert
**Priorität**: 🟡 Mittel

## 📊 Zusammenfassung

### Nach Priorität:

#### 🔴 **Hoch** (15 Features)

1. Image docker/kubernetes/pull_policy
2. Services docker/kubernetes/pull_policy/variables
3. id_tokens (Job + Defaults)
4. secrets (Vault, AWS, GCP, Azure)
5. inherit (default/variables control)
6. Cache: fallback_keys, unprotect, files_commits
7. Artifacts: access control
8. Needs: pipeline/project/ref/parallel matrix
9. Rules: changes.compare_to, exists.project/ref, needs, interruptible
10. Include: inputs für alle Typen (nicht nur component)
11. Include: integrity für remote
12. Variables: erweiterte Definition (value/options/description/expand)
13. Environment: action, kubernetes
14. Trigger: erweiterte Child Pipeline Syntax

#### 🟡 **Mittel** (12 Features)

1. spec.inputs (Top-Level)
2. !reference als globales Feature
3. identity (experimental)
4. hooks (pre_get_sources_script)
5. inputs (Job-Level)
6. run (Alternative zu script)
7. Artifacts: zusätzliche Report-Typen
8. Workflow rules: auto_cancel in rules
9. Release: erweiterte Optionen
10. Trigger: forward Option
11. only/except (Legacy)
12. coverage (Regex)

#### 🟢 **Niedrig** (5 Features)

1. pages (Top-Level special job)
2. Global defaults (deprecated)
3. manual_confirmation
4. publish (deprecated)
5. pages (Job-Level)

### Empfohlene Umsetzung (Phase 1 - Kritisch):

1. ✅ **Image/Services erweiterte Optionen** - Docker/Kubernetes Runner wichtig
2. ✅ **id_tokens** - Cloud-Integration
3. ✅ **secrets** - Secret Manager Integration
4. ✅ **inherit** - Wichtig für komplexe Pipelines
5. ✅ **Cache: fallback_keys** - Sehr praktisch
6. ✅ **Variables: erweiterte Definition** - UI-Features
7. ✅ **Include: inputs + integrity** - Security + Parametrisierung
