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
  setStages(stages: string[]): void {
    this.stagesValue = [...stages]
  }

  addStages(stages: string[]): void {
    const set = new Set(this.stagesValue)
    stages.forEach((s) => set.add(s))
    this.stagesValue = Array.from(set)
  }

  setJob(name: string, definition: JobDefinitionNormalized, options: JobOptions = {}): void {
    this.jobsValue[name] = definition
    if (Object.keys(options).length > 0) {
      this.jobOptionsMapValue[name] = options
    }
  }

  setTemplate(name: string, definition: JobDefinitionNormalized, options: JobOptions = {}): void {
    this.templatesValue[name] = definition
    if (Object.keys(options).length > 0) {
      this.jobOptionsMapValue[name] = options
    }
  }

  getJob(name: string): JobDefinitionNormalized | undefined {
    return this.jobsValue[name] ?? this.templatesValue[name]
  }

  setWorkflow(workflow: Workflow): void {
    this.workflowValue = workflow
  }

  setDefaults(defaults: Defaults): void {
    this.defaultValue = defaults
  }

  setVariables(variables: GlobalVariables): void {
    this.variablesValue = variables
  }

  setVariable(key: string, value: string | number | boolean | undefined): void {
    this.variablesValue[key] = value
  }

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

  addInclude(entry: IncludeEntry): void {
    this.includeValue.push(entry)
  }

  setGlobalOptions(options: Partial<GlobalOptions>): void {
    this.globalOptionsValue = { ...this.globalOptionsValue, ...options }
  }

  setJobOptions(name: string, options: JobOptions): void {
    this.jobOptionsMapValue[name] = options
  }

  setSpec(spec: Spec): void {
    this.specValue = spec
  }

  setDeprecatedImage(image: Image): void {
    this.deprecatedImageValue = image
  }

  setDeprecatedServices(services: Services): void {
    this.deprecatedServicesValue = services
  }

  setDeprecatedBeforeScript(script: Script): void {
    this.deprecatedBeforeScriptValue = script
  }

  setDeprecatedAfterScript(script: Script): void {
    this.deprecatedAfterScriptValue = script
  }

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
