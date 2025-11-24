import type {
  Artifacts,
  Cache,
  Image,
  JobDefinitionInput,
  JobOptions,
  Script,
  Services,
  Variables,
} from "../schema"
import type { ConfigBuilder } from "./ConfigBuilder"

/**
 * Fluent builder for job definitions
 * Provides chainable methods for common job properties
 */
export class JobBuilder {
  private jobName: string
  private definition: JobDefinitionInput = {}
  private options: JobOptions = {}
  private config: ConfigBuilder
  private isTemplateJob: boolean

  constructor(
    name: string,
    config: ConfigBuilder,
    isTemplate = false,
    initialDefinition?: JobDefinitionInput,
    initialOptions?: JobOptions,
  ) {
    this.jobName = name
    this.config = config
    this.isTemplateJob = isTemplate
    if (initialDefinition) {
      this.definition = { ...initialDefinition }
    }
    if (initialOptions) {
      this.options = { ...initialOptions }
    }
  }

  /**
   * Set job stage
   */
  stage(stage: string) {
    this.definition.stage = stage
    return this
  }

  /**
   * Set extends
   */
  extends(extend: string | string[]) {
    this.definition.extends = extend
    return this
  }

  /**
   * Set image
   */
  image(image: Image) {
    this.definition.image = image
    return this
  }

  /**
   * Set script
   */
  script(script: Script) {
    this.definition.script = script
    return this
  }

  /**
   * Set before_script
   */
  beforeScript(script: Script) {
    this.definition.before_script = script
    return this
  }

  /**
   * Set after_script
   */
  afterScript(script: Script) {
    this.definition.after_script = script
    return this
  }

  /**
   * Set services
   */
  services(services: Services) {
    this.definition.services = services
    return this
  }

  /**
   * Set cache
   */
  cache(cache: Cache) {
    this.definition.cache = cache
    return this
  }

  /**
   * Set artifacts
   */
  artifacts(artifacts: Artifacts) {
    this.definition.artifacts = artifacts
    return this
  }

  /**
   * Set variables
   */
  setVariables(variables: Variables) {
    this.definition.variables = variables
    return this
  }

  /**
   * Set environment
   */
  environment(environment: JobDefinitionInput["environment"]) {
    this.definition.environment = environment
    return this
  }

  /**
   * Set when
   */
  when(when: JobDefinitionInput["when"]) {
    this.definition.when = when
    return this
  }

  /**
   * Set rules
   */
  rules(rules: JobDefinitionInput["rules"]) {
    this.definition.rules = rules
    return this
  }

  /**
   * Set needs
   */
  needs(needs: JobDefinitionInput["needs"]) {
    this.definition.needs = needs
    return this
  }

  /**
   * Set tags
   */
  tags(tags: string[]) {
    this.definition.tags = tags
    return this
  }

  /**
   * Set allow_failure
   */
  allowFailure(allow: boolean) {
    this.definition.allow_failure = allow
    return this
  }

  /**
   * Set timeout
   */
  timeout(timeout: string) {
    this.definition.timeout = timeout
    return this
  }

  /**
   * Set retry
   */
  retry(retry: JobDefinitionInput["retry"]) {
    this.definition.retry = retry
    return this
  }

  /**
   * Set parallel
   */
  parallel(parallel: number | JobDefinitionInput["parallel"]) {
    this.definition.parallel = parallel
    return this
  }

  /**
   * Set trigger
   */
  trigger(trigger: JobDefinitionInput["trigger"]) {
    this.definition.trigger = trigger
    return this
  }

  /**
   * Set coverage
   */
  coverage(coverage: string) {
    this.definition.coverage = coverage
    return this
  }

  /**
   * Set dependencies
   */
  dependencies(dependencies: string[]) {
    this.definition.dependencies = dependencies
    return this
  }

  /**
   * Set resource_group
   */
  resourceGroup(group: string) {
    this.definition.resource_group = group
    return this
  }

  /**
   * Set release
   */
  release(release: JobDefinitionInput["release"]) {
    this.definition.release = release
    return this
  }

  /**
   * Set interruptible
   */
  interruptible(interruptible: boolean) {
    this.definition.interruptible = interruptible
    return this
  }

  /**
   * Set id_tokens
   */
  idTokens(tokens: JobDefinitionInput["id_tokens"]) {
    this.definition.id_tokens = tokens
    return this
  }

  /**
   * Bulk set multiple properties at once
   */
  set(properties: Partial<JobDefinitionInput>) {
    this.definition = { ...this.definition, ...properties }
    return this
  }

  /**
   * Set job options
   */
  jobOptions(options: JobOptions) {
    this.options = { ...this.options, ...options }
    return this
  }

  /**
   * Mark job as remote
   */
  remote(remote = true) {
    this.options.remote = remote
    return this
  }

  /**
   * Set mergeExtends option
   */
  mergeExtends(merge = true) {
    this.options.mergeExtends = merge
    return this
  }

  /**
   * Set resolveTemplatesOnly option
   */
  resolveTemplatesOnly(resolve = true) {
    this.options.resolveTemplatesOnly = resolve
    return this
  }

  /**
   * Finalize the job and return to ConfigBuilder
   * This is called automatically when addJob/addTemplate is called
   */
  done(): ConfigBuilder {
    this.save()
    return this.config
  }

  /**
   * Save the current job definition to the config
   * @internal
   */
  save(): void {
    // Use type assertion to access internal methods
    const configInternal = this.config as unknown as {
      template: (name: string, def: JobDefinitionInput, opts: JobOptions) => void
      job: (name: string, def: JobDefinitionInput, opts: JobOptions) => void
    }

    if (this.isTemplateJob) {
      configInternal.template(this.jobName, this.definition, this.options)
    } else {
      configInternal.job(this.jobName, this.definition, this.options)
    }
  }

  /**
   * Allow access to ConfigBuilder methods from JobBuilder
   * This enables auto-return behavior when calling addJob/addTemplate
   */
  addJob(name: string): JobBuilder {
    this.save()
    const configInternal = this.config as unknown as {
      addJob: (name: string) => JobBuilder
    }
    return configInternal.addJob(name)
  }

  addTemplate(name: string): JobBuilder {
    this.save()
    const configInternal = this.config as unknown as {
      addTemplate: (name: string) => JobBuilder
    }
    return configInternal.addTemplate(name)
  }

  stages(...stages: string[]): ConfigBuilder {
    this.save()
    return this.config.stages(...stages)
  }

  variables(vars: Variables): ConfigBuilder {
    this.save()
    return this.config.variables(vars)
  }
}
