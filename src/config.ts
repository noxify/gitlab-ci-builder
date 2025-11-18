import merge from "deepmerge"
import { globSync } from "tinyglobby"

import type {
  GitLabCi,
  IncludeDefinition,
  IncludeOutputDefinition,
  JobDefinition,
  JobDefinitionExtends,
  LocalInclude,
  RemoteInclude,
  VariablesDefinition,
} from "."

export type MacroArgs = unknown

// A utility type for functions or operations that may be synchronous
// or return a Promise. Useful for callbacks like `extendConfig` that
// can either mutate the provided `Config` synchronously or perform
// async work and return a Promise.
export type MaybeAsync<T> = T | Promise<T>

export type ExtendConfigFunction = (config: Config) => MaybeAsync<void>

/**
 * A global OOP-style GitLab CI configurator.
 */
export class Config {
  // Internal state directly on the instance instead of nested plain object
  private stagesValue: string[] = []
  private jobsValue: Record<string, JobDefinition> = {}
  private templatesValue: Record<string, JobDefinition> = {}
  private workflowValue: GitLabCi["workflow"] = { rules: [] }
  private defaultValue?: GitLabCi["default"]
  private variablesValue: VariablesDefinition = {}
  private macros: Record<string, (config: Config, args: MacroArgs) => void> = {}
  private patchers: ((plain: GitLabCi) => void)[] = []
  private includeValue: IncludeOutputDefinition[] = []

  /**
   * Define pipeline stages.
   *
   * Stages are a global ordered list that jobs reference via their `stage` field.
   * Calling this method will merge new stage names into the existing list while
   * preserving order and ensuring uniqueness.
   *
   * @param stages - One or more stage names to add to the pipeline.
   * @returns The same `Config` instance (fluent API).
   * @see https://docs.gitlab.com/ci/yaml/#stages
   */
  public stages(...stages: string[]) {
    const set = new Set(this.stagesValue)
    stages.forEach((s) => set.add(s))
    this.stagesValue = Array.from(set)
    return this
  }

  /** Add a single stage ensuring uniqueness */
  public addStage(stage: string) {
    return this.stages(stage)
  }

  /**
   * Set or merge the top-level `workflow` configuration.
   *
   * `workflow` controls whether a pipeline should be created for a given push or merge
   * request. This method performs a deep merge with any previously set workflow value.
   *
   * @param workflow - Partial workflow object (typically contains `rules`).
   * @returns The same `Config` instance (fluent API).
   * @see https://docs.gitlab.com/ci/yaml/#workflow
   */
  public workflow(workflow: GitLabCi["workflow"]) {
    const current = this.workflowValue ?? { rules: [] }
    const incoming = workflow ?? { rules: [] }
    this.workflowValue = merge(current, incoming) as GitLabCi["workflow"]
    return this
  }

  /**
   * Set global `default` parameters for all jobs.
   *
   * Values set here will be merged with any existing defaults and will act as the base
   * configuration for individual jobs (they can be overridden per-job).
   *
   * @param defaults - Partial `default` configuration object.
   * @returns The same `Config` instance (fluent API).
   * @see https://docs.gitlab.com/ci/yaml/#default
   */
  public defaults(defaults: GitLabCi["default"]) {
    const current = this.defaultValue ?? {}
    const incoming = defaults ?? {}
    this.defaultValue = merge(current, incoming) as GitLabCi["default"]
    return this
  }

  /**
   * Set a single variable on the global variables map.
   *
   * This stores primitive variable values (string|number|boolean|undefined) which will be
   * emitted into the final YAML under the `variables:` top-level key unless they remain empty.
   *
   * @param key - Variable name.
   * @param value - Variable value or `undefined` to unset.
   * @returns The same `Config` instance (fluent API).
   * @see https://docs.gitlab.com/ci/yaml/#variables
   */
  public variable(key: string, value: string | number | boolean | undefined) {
    this.variablesValue[key] = value
    return this
  }

  /**
   * Merge multiple variables into the global variables map.
   *
   * Keys provided in `vars` overwrite existing values with the same name.
   */
  public variables(vars: VariablesDefinition) {
    this.variablesValue = { ...this.variablesValue, ...vars }
    return this
  }

  /**
   * Retrieve a variable value, checking job-local variables first then global variables.
   *
   * @param job - Job name to look up a job-local variable from.
   * @param key - Variable name.
   * @returns The variable value if set, otherwise `undefined`.
   */
  public getVariable(job: string, key: string) {
    const jobVariable = this.jobsValue[job]?.variables?.[key]
    return jobVariable ?? this.variablesValue[key]
  }

  /**
   * Retrieve a job or template definition by name.
   *
   * This looks up concrete jobs first, then templates (hidden jobs start with `.`).
   * @param name - Job or template name (may include leading `.` for templates).
   * @returns The job definition or `undefined` if not found.
   */
  public getJob(name: string): JobDefinition | undefined {
    return this.jobsValue[name] ?? this.templatesValue[name]
  }

  /**
   * Define or merge a template (hidden) job.
   *
   * Template jobs are stored with a leading dot in their name (e.g. `.base`) and are
   * not executed directly; other jobs may `extends` from them. If a template with the
   * same name exists and `options.mergeExisting` is true, the new definition is deep-merged
   * into the existing template.
   *
   * @param name - Template name (may be provided without leading `.`).
   * @param definition - Job definition object for the template.
   * @param options - Options; `mergeExisting` controls deep-merge behavior.
   * @returns The same `Config` instance (fluent API).
   * @see https://docs.gitlab.com/ee/ci/yaml/#hide-jobs
   */
  public template(
    name: string,
    definition: JobDefinition,
    options: { mergeExisting?: boolean } = { mergeExisting: true },
  ) {
    // Ensure the name starts with a dot
    const templateName = name.startsWith(".") ? name : `.${name}`

    if (!this.templatesValue[templateName]) {
      this.templatesValue[templateName] = definition
    } else if (options.mergeExisting) {
      this.templatesValue[templateName] = merge(this.templatesValue[templateName], definition)
    }
    return this
  }

  /**
   * Add one or more `include:` entries.
   *
   * This method accepts strings, objects or arrays thereof and normalizes them
   * into a consistent output form. Runtime normalization rules:
   * - Plain strings starting with `http://` or `https://` are converted to `{ remote: "..." }`.
   * - Other plain strings are converted to `{ local: "..." }`.
   * - Object entries are preserved as-is.
   *
   * The normalized entries are stored internally in `this.includeValue` and will
   * be emitted under the `include` key by `getPlainObject()`.
   *
   * @param item - Include entry (string/object) or array of include entries.
   * @returns The same `Config` instance (fluent API).
   */
  public include(item: IncludeDefinition | IncludeDefinition[]) {
    const isUrl = (s: string) => /^https?:\/\//i.test(s)

    // Push normalized entries directly to internal storage to avoid
    // creating intermediate arrays and extra allocations.
    const pushNormalized = (v: IncludeDefinition | IncludeDefinition[]) => {
      if (Array.isArray(v)) {
        for (const inner of v) pushNormalized(inner)
        return
      }

      if (typeof v === "string") {
        const entry: IncludeOutputDefinition = isUrl(v)
          ? ({ remote: v } as RemoteInclude)
          : ({ local: v } as LocalInclude)
        this.includeValue.push(entry)
        return
      }

      // already an object entry that matches the include shape
      this.includeValue.push(v)
    }

    pushNormalized(item)
    return this
  }

  /**
   * Define a job or a hidden template alias.
   *
   * Behavior:
   * - If `name` starts with `.` it is treated as a template and delegated to `template()`.
   * - If `hidden` is truthy, the name is ensured to be stored as a template name (prefixed
   *   with a single `.`) and delegated to `template()`.
   * - Otherwise the job is added or, if an existing job exists and `options.mergeExisting`
   *   is true, merged via deep-merge.
   *
   * Note: this method will not emit jobs at top-level; `getPlainObject()` returns a
   * combined `jobs` map consisting of templates and jobs (templates keep their leading dot).
   *
   * @param name - Job name (or template name with leading dot).
   * @param definition - Job definition object.
   * @param hidden - If true, the job will be stored as a template (leading dot added if missing).
   * @param options - Merge options; `mergeExisting` controls deep-merge behavior.
   * @returns The same `Config` instance (fluent API).
   * @see https://docs.gitlab.com/ee/ci/yaml/#configuration-parameters
   */
  public job(
    name: string,
    definition: JobDefinition,
    hidden = false,
    options: { mergeExisting?: boolean } = { mergeExisting: true },
  ) {
    // If name starts with a dot, treat it as a template. If `hidden` is true,
    // ensure the name is prefixed with a single dot; do not add an extra dot
    // when the provided name already starts with one.
    if (name.startsWith(".") || hidden) {
      const useName = name.startsWith(".") ? name : `.${name}`
      return this.template(useName, definition, options)
    }

    if (!this.jobsValue[name]) {
      this.jobsValue[name] = definition
    } else if (options.mergeExisting) {
      this.jobsValue[name] = merge(this.jobsValue[name], definition)
    }
    return this
  }

  /**
   * Register a macro function.
   *
   * Macros are named callbacks that receive the `Config` instance and a typed
   * argument object. They can be used to programmatically create multiple jobs or
   * apply recurring modifications.
   *
   * @param key - Macro name (must be unique).
   * @param callback - Function invoked when the macro is applied via `from()`.
   */
  public macro<T extends MacroArgs>(key: string, callback: (config: Config, args: T) => void) {
    if (this.macros[key]) {
      throw new Error(`Macro ${key} already defined! You are not allowed to overwrite it.`)
    }

    this.macros[key] = callback as (config: Config, args: MacroArgs) => void
  }

  /**
   * Apply a previously registered macro by name.
   *
   * Throws if the macro has not been registered. The macro receives this
   * `Config` instance and the supplied `args` value.
   *
   * @param key - Macro name to execute.
   * @param args - Arguments passed to the macro callback.
   */
  public from<T extends MacroArgs>(key: string, args: T) {
    if (!this.macros[key]) {
      throw new Error(
        `Macro ${key} not found, please register it with Config#macro! Consider also, that you need to register the macro before you execute from it.`,
      )
    }

    this.macros[key](this, args)
  }

  /**
   * Shorthand to create a job that extends one or more templates/jobs.
   *
   * This wraps `job()` and injects an `extends` property (deep-merged when
   * resolving) so the provided `name` will inherit properties from the listed
   * source templates/jobs. `fromName` may be a single name or an array of names.
   *
   * @param fromName - Template or job name(s) to extend from (may include leading `.`).
   * @param name - Name of the new job.
   * @param job - Optional job definition to merge on top of the resolved extends.
   * @param hidden - If true, the created job will be stored as a template (leading dot added).
   */
  public extends(fromName: string | string[], name: string, job?: JobDefinition, hidden = false) {
    this.job(
      name,
      merge(job ?? {}, { extends: Array.isArray(fromName) ? fromName : [fromName] }),
      hidden,
    )
  }

  /**
   * Dynamically include other TypeScript configuration modules by glob.
   *
   * For every file matched by `globs` (resolved relative to `cwd`), this method
   * will `import()` the file and call its exported `extendConfig` function with
   * this `Config` instance. The imported file must export an `extendConfig`
   * function; otherwise an error is thrown.
   *
   * @param cwd - Base directory for the globs (use `process.cwd()` normally).
   * @param globs - Glob patterns to match files (tinyglobby semantics).
   */
  public async dynamicInclude(cwd: string, globs: string[]) {
    for (const glob of globs) {
      const files = globSync(glob, {
        absolute: true,
        cwd,
        dot: true,
      })

      for (const file of files) {
        // eslint-disable-next-line no-console
        console.log(`Include file "${file}..."`)
        const exported = (await import(file)) as { extendConfig?: ExtendConfigFunction } | undefined
        if (!exported?.extendConfig) {
          throw new Error(`Please export a function extendConfig which returns a Config instance!`)
        }

        if (!(exported.extendConfig instanceof Function)) {
          throw new Error(`The exported extendConfig is not a function!`)
        }

        await exported.extendConfig(this)
      }
    }
  }

  /**
   * Internal helper to recursively collect extends provenance.
   *
   * Walks the `extends` chain for a job and accumulates the required ordering
   * so that parent templates are merged before child jobs. Mutates `firstJob`
   * by prepending `needsExtends` entries that represent the traversal order.
   */
  private recursivelyExtend(
    pipeline: GitLabCi,
    firstJob: JobDefinitionExtends,
    job: JobDefinitionExtends = firstJob,
  ) {
    if (job.extends) {
      job.needsExtends ??= []

      for (const from of job.extends) {
        let jobKey: string | undefined
        if (pipeline.jobs?.[from]) {
          jobKey = from
        } else if (pipeline.jobs?.[`.${from}`]) {
          jobKey = `.${from}`
        }

        if (!jobKey || !pipeline.jobs) {
          // eslint-disable-next-line no-console
          console.warn(`The job "${from}" does not exist, skipping...`)
          continue
        }
        const jobObj = pipeline.jobs[jobKey]
        if (!jobObj) continue

        firstJob.needsExtends?.unshift(from)

        this.recursivelyExtend(pipeline, firstJob, jobObj)
      }
    }
  }

  /**
   * Resolve all `extends` references in a pipeline copy.
   *
   * This replaces job definitions with the result of deep-merging their
   * resolved templates in the correct order. Templates (keys starting with `.`)
   * are not themselves resolved here.
   *
   * @param pipeline - A copy of the pipeline object to resolve (modified in place).
   */
  private resolveExtends(pipeline: GitLabCi) {
    if (!pipeline.jobs) return

    const jobIds = Object.keys(pipeline.jobs)
    for (const key of jobIds) {
      const job = pipeline.jobs[key]
      if (!job || !job.extends || key.startsWith(".")) continue

      this.recursivelyExtend(pipeline, job)

      let result: JobDefinitionExtends = {}
      const { needsExtends } = job as JobDefinitionExtends
      if (needsExtends) {
        for (const extendKey of needsExtends) {
          const extendJob = pipeline.jobs[extendKey]
          if (extendJob) {
            result = merge(result, extendJob)
          }
        }
      }

      // The main job definition has highest priority
      pipeline.jobs[key] = merge(result, job)
    }
  }

  /**
   * Cleanup temporary `extends` metadata after resolution.
   *
   * This removes `extends` keys that referred to local templates (so that the
   * final serialized output does not contain the internal `extends` helper),
   * and also removes the helper `needsExtends` property.
   *
   * @param pipeline - The pipeline object being prepared for output.
   */
  private clear(pipeline: GitLabCi) {
    // Finally, remove all existing `extends`
    if (!pipeline.jobs) return

    const jobIds = Object.keys(pipeline.jobs)
    for (const key of jobIds) {
      const job = pipeline.jobs[key] as JobDefinitionExtends
      if (job.extends) {
        job.extends = job.extends.filter((extendName) => !jobIds.includes(extendName))
        if (!job.extends.length) {
          delete job.extends
          delete job.needsExtends
        }
      }
    }
  }

  /**
   * Register a patcher callback.
   *
   * Patcher callbacks are invoked with the pipeline plain object after
   * `extends` resolution and before the final output is returned. They can be
   * used to perform last-minute adjustments to the pipeline object.
   *
   * @param callback - Function that receives the plain `GitLabCi` object.
   */
  public patch(callback: Config["patchers"][number]) {
    this.patchers.push(callback)
  }

  /**
   * Build and return a deep-cloned, YAML-serializable representation of the config.
   *
   * The returned object contains merged `jobs` (templates + jobs) under the
   * `jobs` property. It has had `extends` resolved and patchers applied. This
   * method intentionally returns an object that is safe to `JSON.stringify`.
   *
   * @returns A `GitLabCi` plain object suitable for serialization.
   */
  public getPlainObject() {
    // Create a deep copy to avoid mutating internal state
    // Merge templates and jobs (templates first, then jobs can override)
    const copy: GitLabCi = JSON.parse(
      JSON.stringify({
        stages: this.stagesValue.length ? [...this.stagesValue] : undefined,
        workflow:
          this.workflowValue && Object.keys(this.workflowValue).length > 0
            ? // Only include workflow if it has meaningful content beyond empty rules
              this.workflowValue.rules.length || Object.keys(this.workflowValue).length > 1
              ? this.workflowValue
              : undefined
            : undefined,
        default: this.defaultValue,
        variables: Object.keys(this.variablesValue).length ? { ...this.variablesValue } : undefined,
        include: this.includeValue.length ? [...this.includeValue] : undefined,
        jobs: { ...this.templatesValue, ...this.jobsValue },
      }),
    ) as GitLabCi

    // Resolve extends
    this.resolveExtends(copy)
    this.clear(copy)

    // Apply patchers (for macros and imports)
    for (const patcher of this.patchers) {
      patcher(copy)
    }

    return copy
  }

  /** JSON.stringify helper */
  public toJSON() {
    return this.getPlainObject()
  }
}
