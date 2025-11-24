import type {
  Cache,
  Defaults,
  GlobalOptions,
  GlobalVariables,
  Image,
  IncludeEntry,
  JobDefinitionNormalized,
  JobDefinitionOutput,
  JobOptions,
  Script,
  Services,
  Spec,
  Workflow,
} from "../schema"

/**
 * Pipeline state - the internal model that holds all configuration
 */
export class PipelineState {
  private stagesValue: string[] = []
  private jobsValue: Record<string, JobDefinitionNormalized> = {}
  private templatesValue: Record<string, JobDefinitionNormalized> = {}
  private workflowValue?: Workflow
  private defaultValue?: Defaults
  private variablesValue: GlobalVariables = {}
  private includeValue: IncludeEntry[] = []
  private globalOptionsValue: GlobalOptions
  private jobOptionsMapValue: Record<string, JobOptions> = {}
  private specValue?: Spec
  // Deprecated global options (use defaults instead)
  private deprecatedImageValue?: Image
  private deprecatedServicesValue?: Services
  private deprecatedBeforeScriptValue?: Script
  private deprecatedAfterScriptValue?: Script
  private deprecatedCacheValue?: Cache

  constructor(globalOptions?: Partial<GlobalOptions>) {
    this.globalOptionsValue = {
      mergeExtends: true,
      mergeExisting: true,
      resolveTemplatesOnly: true,
      performanceMode: false,
      missingExtendsPolicy: "warn",
      ...globalOptions,
    }
  }

  // Getters
  get stages(): readonly string[] {
    return this.stagesValue
  }

  get jobs(): Readonly<Record<string, JobDefinitionNormalized>> {
    return this.jobsValue
  }

  get templates(): Readonly<Record<string, JobDefinitionNormalized>> {
    return this.templatesValue
  }

  get workflow(): Workflow | undefined {
    return this.workflowValue
  }

  get defaults(): Defaults | undefined {
    return this.defaultValue
  }

  get variables(): Readonly<GlobalVariables> {
    return this.variablesValue
  }

  get include(): readonly IncludeEntry[] {
    return this.includeValue
  }

  get globalOptions(): Readonly<GlobalOptions> {
    return this.globalOptionsValue
  }

  get jobOptionsMap(): Readonly<Record<string, JobOptions>> {
    return this.jobOptionsMapValue
  }

  get spec(): Spec | undefined {
    return this.specValue
  }

  get deprecatedImage(): Image | undefined {
    return this.deprecatedImageValue
  }

  get deprecatedServices(): Services | undefined {
    return this.deprecatedServicesValue
  }

  get deprecatedBeforeScript(): Script | undefined {
    return this.deprecatedBeforeScriptValue
  }

  get deprecatedAfterScript(): Script | undefined {
    return this.deprecatedAfterScriptValue
  }

  get deprecatedCache(): Cache | undefined {
    return this.deprecatedCacheValue
  }

  // Setters
  /**
   * Set the pipeline stages, replacing any existing stages.
   *
   * @param stages - Array of stage names
   *
   * @example
   * ```ts
   * state.setStages(['build', 'test', 'deploy'])
   * ```
   *
   * @see https://docs.gitlab.com/ci/yaml/#stages
   */
  setStages(stages: string[]): void {
    this.stagesValue = [...stages]
  }

  /**
   * Add stages to the pipeline, merging with existing stages.
   *
   * Duplicate stages are automatically filtered out.
   *
   * @param stages - Array of stage names to add
   *
   * @example
   * ```ts
   * state.setStages(['build', 'test'])
   * state.addStages(['test', 'deploy']) // Result: ['build', 'test', 'deploy']
   * ```
   */
  addStages(stages: string[]): void {
    const set = new Set(this.stagesValue)
    stages.forEach((s) => set.add(s))
    this.stagesValue = Array.from(set)
  }

  /**
   * Set a job definition in the pipeline.
   *
   * @param name - Job name
   * @param definition - Normalized job definition
   * @param options - Optional job metadata (remote flag, etc.)
   *
   * @example
   * ```ts
   * state.setJob('build', { stage: 'build', script: ['npm run build'] })
   * state.setJob('remote-job', { script: ['test'] }, { remote: true })
   * ```
   *
   * @see https://docs.gitlab.com/ci/jobs/
   */
  setJob(name: string, definition: JobDefinitionNormalized, options: JobOptions = {}): void {
    this.jobsValue[name] = definition
    if (Object.keys(options).length > 0) {
      this.jobOptionsMapValue[name] = options
    }
  }

  /**
   * Set a template (hidden job) definition in the pipeline.
   *
   * Templates are jobs that start with `.` and are not executed directly.
   *
   * @param name - Template name (should start with `.`)
   * @param definition - Normalized job definition
   * @param options - Optional template metadata (remote flag, etc.)
   *
   * @example
   * ```ts
   * state.setTemplate('.build-template', {
   *   script: ['npm run build']
   * })
   * ```
   *
   * @see https://docs.gitlab.com/ci/jobs/job_control.html#hide-jobs
   */
  setTemplate(name: string, definition: JobDefinitionNormalized, options: JobOptions = {}): void {
    this.templatesValue[name] = definition
    if (Object.keys(options).length > 0) {
      this.jobOptionsMapValue[name] = options
    }
  }

  /**
   * Get a job or template definition by name.
   *
   * Checks both jobs and templates, returning the first match found.
   *
   * @param name - Job or template name
   * @returns Job definition, or undefined if not found
   *
   * @example
   * ```ts
   * const job = state.getJob('build')
   * const template = state.getJob('.build-template')
   * ```
   */
  getJob(name: string): JobDefinitionNormalized | undefined {
    return this.jobsValue[name] ?? this.templatesValue[name]
  }

  /**
   * Set the pipeline workflow configuration.
   *
   * @param workflow - Workflow rules and configuration
   *
   * @example
   * ```ts
   * state.setWorkflow({ rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }] })
   * ```
   *
   * @see https://docs.gitlab.com/ci/yaml/#workflow
   */
  setWorkflow(workflow: Workflow): void {
    this.workflowValue = workflow
  }

  /**
   * Set default values for all jobs.
   *
   * @param defaults - Default configuration applied to all jobs
   *
   * @example
   * ```ts
   * state.setDefaults({ retry: 2, timeout: '1h' })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#default
   */
  setDefaults(defaults: Defaults): void {
    this.defaultValue = defaults
  }

  /**
   * Set global pipeline variables, replacing any existing variables.
   *
   * @param variables - Global variables as key-value pairs
   *
   * @example
   * ```ts
   * state.setVariables({ NODE_VERSION: '18', DEBUG: true })
   * ```
   *
   * @see https://docs.gitlab.com/ci/yaml/#variables
   */
  setVariables(variables: GlobalVariables): void {
    this.variablesValue = variables
  }

  /**
   * Set a single global variable.
   *
   * @param key - Variable name
   * @param value - Variable value
   *
   * @example
   * ```ts
   * state.setVariable('NODE_VERSION', '18')
   * state.setVariable('ENABLE_CACHE', true)
   * ```
   *
   * @see https://docs.gitlab.com/ci/yaml/#variables
   */
  setVariable(key: string, value: string | number | boolean | undefined): void {
    this.variablesValue[key] = value
  }

  /**
   * Get a variable value for a specific job.
   *
   * Checks job-specific variables first, then falls back to global variables.
   * Handles both primitive values and complex variable objects with `value` property.
   *
   * @param jobName - Job name to get the variable for
   * @param key - Variable name
   * @returns Variable value, or undefined if not found
   *
   * @example
   * ```ts
   * state.setVariable('GLOBAL_VAR', 'global')
   * state.setJob('build', { variables: { JOB_VAR: 'local' } })
   *
   * state.getVariable('build', 'JOB_VAR')    // Returns: 'local'
   * state.getVariable('build', 'GLOBAL_VAR') // Returns: 'global'
   * ```
   */
  getVariable(jobName: string, key: string): string | number | boolean | undefined {
    const jobVariable = this.jobsValue[jobName]?.variables?.[key]
    const globalVariable = this.variablesValue[key]

    // Extract value from job variable (could be primitive or object)
    const jobValue =
      jobVariable !== undefined && typeof jobVariable === "object" && "value" in jobVariable
        ? jobVariable.value
        : jobVariable

    // Extract value from global variable (could be primitive or object)
    const globalValue =
      globalVariable !== undefined &&
      typeof globalVariable === "object" &&
      "value" in globalVariable
        ? globalVariable.value
        : globalVariable

    return jobValue ?? globalValue
  }

  /**
   * Add an include entry to the pipeline.
   *
   * @param entry - Include entry (local, remote, project, template, or component)
   *
   * @example
   * ```ts
   * state.addInclude({ local: '.gitlab/ci/build.yml' })
   * state.addInclude({ template: 'Security/SAST.gitlab-ci.yml' })
   * ```
   *
   * @see https://docs.gitlab.com/ci/yaml/#include
   */
  addInclude(entry: IncludeEntry): void {
    this.includeValue.push(entry)
  }

  /**
   * Update global options for the pipeline.
   *
   * Merges with existing options.
   *
   * @param options - Partial global options to update
   *
   * @example
   * ```ts
   * state.setGlobalOptions({ mergeExtends: false, performanceMode: true })
   * ```
   */
  setGlobalOptions(options: Partial<GlobalOptions>): void {
    this.globalOptionsValue = { ...this.globalOptionsValue, ...options }
  }

  /**
   * Set metadata options for a specific job.
   *
   * @param name - Job or template name
   * @param options - Job metadata options
   *
   * @example
   * ```ts
   * state.setJobOptions('remote-job', { remote: true })
   * ```
   */
  setJobOptions(name: string, options: JobOptions): void {
    this.jobOptionsMapValue[name] = options
  }

  /**
   * Set the pipeline spec configuration.
   *
   * @param spec - Spec configuration
   *
   * @example
   * ```ts
   * state.setSpec({ inputs: { environment: { default: 'dev' } } })
   * ```
   *
   * @see https://docs.gitlab.com/ci/yaml/#spec
   */
  setSpec(spec: Spec): void {
    this.specValue = spec
  }

  /**
   * Set deprecated global image configuration.
   *
   * @deprecated Use `defaults.image` instead
   * @param image - Docker image configuration
   * @see https://docs.gitlab.com/ci/yaml/#image
   */
  setDeprecatedImage(image: Image): void {
    this.deprecatedImageValue = image
  }

  /**
   * Set deprecated global services configuration.
   *
   * @deprecated Use `defaults.services` instead
   * @param services - Services configuration
   * @see https://docs.gitlab.com/ci/yaml/#services
   */
  setDeprecatedServices(services: Services): void {
    this.deprecatedServicesValue = services
  }

  /**
   * Set deprecated global before_script configuration.
   *
   * @deprecated Use `defaults.before_script` instead
   * @param script - Before script commands
   * @see https://docs.gitlab.com/ci/yaml/#before_script
   */
  setDeprecatedBeforeScript(script: Script): void {
    this.deprecatedBeforeScriptValue = script
  }

  /**
   * Set deprecated global after_script configuration.
   *
   * @deprecated Use `defaults.after_script` instead
   * @param script - After script commands
   * @see https://docs.gitlab.com/ci/yaml/#after_script
   */
  setDeprecatedAfterScript(script: Script): void {
    this.deprecatedAfterScriptValue = script
  }

  /**
   * Set deprecated global cache configuration.
   *
   * @deprecated Use `defaults.cache` instead
   * @param cache - Cache configuration
   * @see https://docs.gitlab.com/ci/yaml/#cache
   */
  setDeprecatedCache(cache: Cache): void {
    this.deprecatedCacheValue = cache
  }

  /**
   * Create a plain object representation (before extends resolution)
   */
  toPlainObject(): {
    spec?: Spec
    stages?: string[]
    workflow?: Workflow
    default?: Defaults
    variables?: GlobalVariables
    include?: IncludeEntry[]
    jobs: Record<string, JobDefinitionNormalized>
    // Deprecated
    image?: Image
    services?: Services
    before_script?: Script
    after_script?: Script
    cache?: Cache
  } {
    return {
      spec: this.specValue,
      stages: this.stagesValue.length > 0 ? [...this.stagesValue] : undefined,
      workflow: this.workflowValue,
      default: this.defaultValue,
      variables:
        Object.keys(this.variablesValue).length > 0 ? { ...this.variablesValue } : undefined,
      include: this.includeValue.length > 0 ? [...this.includeValue] : undefined,
      jobs: { ...this.templatesValue, ...this.jobsValue },
      // Deprecated globals
      image: this.deprecatedImageValue,
      services: this.deprecatedServicesValue,
      before_script: this.deprecatedBeforeScriptValue,
      after_script: this.deprecatedAfterScriptValue,
      cache: this.deprecatedCacheValue,
    }
  }

  /**
   * Clone the state
   */
  clone(): PipelineState {
    const cloned = new PipelineState(this.globalOptionsValue)
    cloned.stagesValue = [...this.stagesValue]
    cloned.jobsValue = { ...this.jobsValue }
    cloned.templatesValue = { ...this.templatesValue }
    cloned.workflowValue = this.workflowValue ? { ...this.workflowValue } : undefined
    cloned.defaultValue = this.defaultValue ? { ...this.defaultValue } : undefined
    cloned.variablesValue = { ...this.variablesValue }
    cloned.includeValue = [...this.includeValue]
    cloned.jobOptionsMapValue = { ...this.jobOptionsMapValue }
    cloned.specValue = this.specValue ? { ...this.specValue } : undefined
    cloned.deprecatedImageValue = this.deprecatedImageValue
    cloned.deprecatedServicesValue = this.deprecatedServicesValue
    cloned.deprecatedBeforeScriptValue = this.deprecatedBeforeScriptValue
    cloned.deprecatedAfterScriptValue = this.deprecatedAfterScriptValue
    cloned.deprecatedCacheValue = this.deprecatedCacheValue
    return cloned
  }
}

/**
 * Final pipeline output (after extends resolution)
 */
export interface PipelineOutput {
  spec?: Spec
  stages?: string[]
  workflow?: Workflow
  default?: Defaults
  variables?: GlobalVariables
  include?: IncludeEntry[]
  jobs?: Record<string, JobDefinitionOutput>
  // Deprecated globals
  image?: Image
  services?: Services
  before_script?: Script
  after_script?: Script
  cache?: Cache
}
