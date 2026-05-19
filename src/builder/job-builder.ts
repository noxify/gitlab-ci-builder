import type { Image, Script, Services, Variables } from "../schema/base"
import type { Artifacts, Cache, JobDefinitionInput } from "../schema/job"
import type { JobOptions } from "../schema/policies"
import type { ConfigBuilder } from "./config-builder"

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
    initialOptions?: JobOptions
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
   * Set the job stage.
   *
   * @param stage - The stage name
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build').stage('build').script('build.sh')
   * ```
   */
  stage(stage: string) {
    this.definition.stage = stage
    return this
  }

  /**
   * Set which templates or jobs this job extends from.
   *
   * @param extend - Single template/job name or array of names
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy').extends('.deploy-template').stage('deploy')
   * ```
   *
   * @example
   * ```ts
   * // Extend from multiple templates
   * config.addJob('deploy').extends(['.docker', '.deploy']).script('deploy.sh')
   * ```
   */
  extends(extend: string | string[]) {
    this.definition.extends = extend
    return this
  }

  /**
   * Set the Docker image for this job.
   *
   * @param image - Docker image name or image configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build').image('node:18').script('npm run build')
   * ```
   *
   * @example
   * ```ts
   * // With advanced image configuration
   * config.addJob('build').image({
   *   name: 'node:18',
   *   entrypoint: ['/bin/sh']
   * })
   * ```
   */
  image(image: Image) {
    this.definition.image = image
    return this
  }

  /**
   * Set the main script commands for this job.
   *
   * @param script - Single command string or array of commands
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build').script('npm run build')
   * ```
   *
   * @example
   * ```ts
   * // Multiple commands
   * config.addJob('build').script([
   *   'npm ci',
   *   'npm run build',
   *   'npm test'
   * ])
   * ```
   */
  script(script: Script) {
    this.definition.script = script
    return this
  }

  /**
   * Set commands to run before the main script.
   *
   * @param script - Single command string or array of commands
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build')
   *   .beforeScript(['npm ci', 'npm run prepare'])
   *   .script('npm run build')
   * ```
   */
  beforeScript(script: Script) {
    this.definition.before_script = script
    return this
  }

  /**
   * Set commands to run after the main script (even if job fails).
   *
   * @param script - Single command string or array of commands
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('test')
   *   .script('npm test')
   *   .afterScript(['npm run cleanup', 'rm -rf temp/'])
   * ```
   */
  afterScript(script: Script) {
    this.definition.after_script = script
    return this
  }

  /**
   * Set Docker services for this job.
   *
   * @param services - Array of service names or service configuration objects
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('integration-test')
   *   .services(['postgres:13', 'redis:6'])
   *   .script('npm run test:integration')
   * ```
   */
  services(services: Services) {
    this.definition.services = services
    return this
  }

  /**
   * Set cache configuration for this job.
   *
   * @param cache - Cache configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build')
   *   .cache({
   *     key: '$CI_COMMIT_REF_SLUG',
   *     paths: ['node_modules/', '.npm/']
   *   })
   *   .script('npm run build')
   * ```
   */
  cache(cache: Cache) {
    this.definition.cache = cache
    return this
  }

  /**
   * Set artifacts configuration for this job.
   *
   * @param artifacts - Artifacts configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build')
   *   .script('npm run build')
   *   .artifacts({
   *     paths: ['dist/', 'build/'],
   *     expire_in: '1 week'
   *   })
   * ```
   */
  artifacts(artifacts: Artifacts) {
    this.definition.artifacts = artifacts
    return this
  }

  /**
   * Set job-specific variables.
   *
   * @param variables - Object containing variable key-value pairs
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .setVariables({
   *     DEPLOY_ENV: 'production',
   *     REGION: 'us-east-1'
   *   })
   *   .script('deploy.sh')
   * ```
   */
  setVariables(variables: Variables) {
    this.definition.variables = variables
    return this
  }

  /**
   * Set the deployment environment for this job.
   *
   * @param environment - Environment configuration (name, url, action, etc.)
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy:prod')
   *   .environment({
   *     name: 'production',
   *     url: 'https://example.com',
   *     on_stop: 'stop_production'
   *   })
   *   .script('deploy.sh')
   * ```
   *
   * @example
   * ```ts
   * // Simple environment name
   * config.addJob('deploy').environment('staging').script('deploy.sh')
   * ```
   */
  environment(environment: JobDefinitionInput["environment"]) {
    this.definition.environment = environment
    return this
  }

  /**
   * Set when this job should run.
   *
   * Controls job execution timing. Options: 'on_success', 'on_failure', 'always',
   * 'manual', 'delayed', or 'never'.
   *
   * @param when - When condition for job execution
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .when('manual')
   *   .script('deploy.sh')
   * ```
   *
   * @example
   * ```ts
   * // Run cleanup job even when pipeline fails
   * config.addJob('cleanup')
   *   .when('always')
   *   .script('cleanup.sh')
   * ```
   */
  when(when: JobDefinitionInput["when"]) {
    this.definition.when = when
    return this
  }

  /**
   * Set rules to control when this job runs.
   *
   * @param rules - Array of rule objects
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .rules([
   *     { if: '$CI_COMMIT_BRANCH == "main"', when: 'always' },
   *     { if: '$CI_COMMIT_BRANCH == "develop"', when: 'manual' }
   *   ])
   *   .script('deploy.sh')
   * ```
   */
  rules(rules: JobDefinitionInput["rules"]) {
    this.definition.rules = rules
    return this
  }

  /**
   * Set job dependencies (which jobs must complete before this one).
   *
   * @param needs - Array of job names or need configurations
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .needs(['build', 'test'])
   *   .script('deploy.sh')
   * ```
   */
  needs(needs: JobDefinitionInput["needs"]) {
    this.definition.needs = needs
    return this
  }

  /**
   * Set runner tags to select which runners can execute this job.
   *
   * @param tags - Array of tag names
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .tags(['docker', 'linux', 'production'])
   *   .script('deploy.sh')
   * ```
   */
  tags(tags: string[]) {
    this.definition.tags = tags
    return this
  }

  /**
   * Set whether this job is allowed to fail without stopping the pipeline.
   *
   * @param allow - Whether to allow failure (default: true)
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('experimental-test')
   *   .script('npm run test:experimental')
   *   .allowFailure(true)
   * ```
   */
  allowFailure(allow: boolean) {
    this.definition.allow_failure = allow
    return this
  }

  /**
   * Set the maximum execution time for this job.
   *
   * @param timeout - Timeout duration (e.g., '1h', '30m', '3h 30m')
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('long-running-test')
   *   .timeout('2h')
   *   .script('npm run test:integration')
   * ```
   */
  timeout(timeout: string) {
    this.definition.timeout = timeout
    return this
  }

  /**
   * Set retry configuration for this job.
   *
   * @param retry - Retry count (number) or retry configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * // Simple retry count
   * config.addJob('flaky-test')
   *   .retry(2)
   *   .script('npm test')
   * ```
   *
   * @example
   * ```ts
   * // Advanced retry configuration
   * config.addJob('deploy')
   *   .retry({
   *     max: 2,
   *     when: ['runner_system_failure', 'stuck_or_timeout_failure']
   *   })
   *   .script('deploy.sh')
   * ```
   */
  retry(retry: JobDefinitionInput["retry"]) {
    this.definition.retry = retry
    return this
  }

  /**
   * Set parallel execution configuration for this job.
   *
   * Runs multiple instances of the job in parallel.
   *
   * @param parallel - Number of parallel instances or parallel configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * // Run 5 parallel instances
   * config.addJob('test')
   *   .parallel(5)
   *   .script('npm test')
   * ```
   *
   * @example
   * ```ts
   * // Matrix parallel execution
   * config.addJob('test')
   *   .parallel({
   *     matrix: [
   *       { PROVIDER: 'aws', STACK: ['app1', 'app2'] },
   *       { PROVIDER: 'gcp', STACK: ['app1'] }
   *     ]
   *   })
   *   .script('test.sh')
   * ```
   */
  parallel(parallel: number | JobDefinitionInput["parallel"]) {
    this.definition.parallel = parallel
    return this
  }

  /**
   * Set trigger configuration to start a downstream pipeline.
   *
   * @param trigger - Trigger configuration (project path or object)
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('trigger:downstream')
   *   .trigger('my-group/my-project')
   * ```
   *
   * @example
   * ```ts
   * // Advanced trigger configuration
   * config.addJob('trigger:child')
   *   .trigger({
   *     include: '.gitlab-ci-child.yml',
   *     strategy: 'depend'
   *   })
   * ```
   */
  trigger(trigger: JobDefinitionInput["trigger"]) {
    this.definition.trigger = trigger
    return this
  }

  /**
   * Set coverage regex pattern to extract test coverage from job output.
   *
   * @param coverage - Regular expression pattern to match coverage percentage
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('test')
   *   .script('npm test')
   *   .coverage('/Coverage: \\d+\\.\\d+%/')
   * ```
   */
  coverage(coverage: string) {
    this.definition.coverage = coverage
    return this
  }

  /**
   * Set which jobs' artifacts this job should download.
   *
   * By default, all artifacts from previous stages are downloaded. Use this
   * to limit artifact downloads to specific jobs.
   *
   * @param dependencies - Array of job names to download artifacts from
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .dependencies(['build', 'compile-assets'])
   *   .script('deploy.sh')
   * ```
   *
   * @example
   * ```ts
   * // Don't download any artifacts
   * config.addJob('test').dependencies([]).script('npm test')
   * ```
   */
  dependencies(dependencies: string[]) {
    this.definition.dependencies = dependencies
    return this
  }

  /**
   * Set resource group to ensure only one job runs at a time.
   *
   * Useful for deployments where only one deployment to a given environment
   * should happen at a time.
   *
   * @param group - Resource group name
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy:production')
   *   .resourceGroup('production')
   *   .script('deploy.sh')
   * ```
   */
  resourceGroup(group: string) {
    this.definition.resource_group = group
    return this
  }

  /**
   * Set release configuration to create a GitLab release.
   *
   * @param release - Release configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('release')
   *   .release({
   *     tag_name: '$CI_COMMIT_TAG',
   *     description: 'Release $CI_COMMIT_TAG',
   *     assets: {
   *       links: [
   *         { name: 'Download', url: 'https://example.com/download' }
   *       ]
   *     }
   *   })
   *   .script('echo "Creating release"')
   * ```
   */
  release(release: JobDefinitionInput["release"]) {
    this.definition.release = release
    return this
  }

  /**
   * Set whether this job can be interrupted by newer pipeline runs.
   *
   * When true, the job will be automatically canceled if a newer pipeline
   * starts for the same ref.
   *
   * @param interruptible - Whether the job is interruptible (default: true)
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('build')
   *   .interruptible(true)
   *   .script('npm run build')
   * ```
   */
  interruptible(interruptible: boolean) {
    this.definition.interruptible = interruptible
    return this
  }

  /**
   * Set ID tokens for OpenID Connect (OIDC) authentication.
   *
   * Use ID tokens to authenticate with cloud providers and other services
   * without storing credentials.
   *
   * @param tokens - ID token configuration object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy:aws')
   *   .idTokens({
   *     AWS_ID_TOKEN: {
   *       aud: 'https://aws.amazon.com'
   *     }
   *   })
   *   .script('deploy-to-aws.sh')
   * ```
   */
  idTokens(tokens: JobDefinitionInput["id_tokens"]) {
    this.definition.id_tokens = tokens
    return this
  }

  /**
   * Bulk set multiple job properties at once.
   *
   * @param properties - Partial job definition with properties to set
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('deploy')
   *   .set({
   *     stage: 'deploy',
   *     script: 'deploy.sh',
   *     environment: { name: 'production' },
   *     when: 'manual'
   *   })
   * ```
   */
  set(properties: Partial<JobDefinitionInput>) {
    this.definition = { ...this.definition, ...properties }
    return this
  }

  /**
   * Set job-specific options.
   *
   * @param options - Job options object
   * @returns JobBuilder instance for method chaining
   *
   * @example
   * ```ts
   * config.addJob('test')
   *   .script('test.sh')
   *   .jobOptions({ mergeExtends: false })
   * ```
   */
  jobOptions(options: JobOptions) {
    this.options = { ...this.options, ...options }
    return this
  }

  /**
   * Mark this job as remote (from an include).
   *
   * @param remote - Whether the job is remote (default: true)
   * @returns JobBuilder instance for method chaining
   */
  remote(remote = true) {
    this.options.remote = remote
    return this
  }

  /**
   * Set mergeExtends option for this job.
   *
   * @param merge - Whether to merge extends chains (default: true)
   * @returns JobBuilder instance for method chaining
   */
  mergeExtends(merge = true) {
    this.options.mergeExtends = merge
    return this
  }

  /**
   * Set resolveTemplatesOnly option for this job.
   *
   * @param resolve - Whether to only resolve template extends (default: true)
   * @returns JobBuilder instance for method chaining
   */
  resolveTemplatesOnly(resolve = true) {
    this.options.resolveTemplatesOnly = resolve
    return this
  }

  /**
   * Finalize the job definition and return to ConfigBuilder.
   *
   * This saves the job and returns the parent ConfigBuilder instance.
   * Note: This is called automatically when starting a new job with `addJob()`.
   *
   * @returns The parent ConfigBuilder instance
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .addJob('build')
   *     .stage('build')
   *     .script('build.sh')
   *     .done()
   *   .addJob('test')
   *     .stage('test')
   *     .script('test.sh')
   *     .done()
   * ```
   */
  done(): ConfigBuilder {
    this.save()
    return this.config
  }

  /**
   * Save the current job definition to the ConfigBuilder.
   *
   * This method persists the accumulated job definition and options to the parent
   * ConfigBuilder instance by calling either `template()` or `job()` internally.
   */
  private save(): void {
    // Use type assertion to access internal methods
    const configInternal = this.config as unknown as {
      template: (
        name: string,
        def: JobDefinitionInput,
        opts: JobOptions
      ) => void
      job: (name: string, def: JobDefinitionInput, opts: JobOptions) => void
    }

    if (this.isTemplateJob) {
      configInternal.template(this.jobName, this.definition, this.options)
    } else {
      configInternal.job(this.jobName, this.definition, this.options)
    }
  }

  /**
   * Save current job and start defining a new job.
   *
   * This is a convenience method that saves the current job definition
   * and immediately starts a new job builder.
   *
   * @param name - Name of the new job
   * @returns New JobBuilder instance
   *
   * @example
   * ```ts
   * config
   *   .addJob('build')
   *     .stage('build')
   *     .script('build.sh')
   *   .addJob('test')
   *     .stage('test')
   *     .script('test.sh')
   *     .done()
   * ```
   */
  addJob(name: string): JobBuilder {
    this.save()
    const configInternal = this.config as unknown as {
      addJob: (name: string) => JobBuilder
    }
    return configInternal.addJob(name)
  }

  /**
   * Save current job and start defining a new template.
   *
   * This is a convenience method that saves the current job definition
   * and immediately starts a new template builder.
   *
   * @param name - Name of the new template (will be prefixed with '.' if not already)
   * @returns New JobBuilder instance
   *
   * @example
   * ```ts
   * config
   *   .addTemplate('.base')
   *     .before_script('setup.sh')
   *   .addTemplate('.docker')
   *     .image('docker:latest')
   *     .done()
   * ```
   */
  addTemplate(name: string): JobBuilder {
    this.save()
    const configInternal = this.config as unknown as {
      addTemplate: (name: string) => JobBuilder
    }
    return configInternal.addTemplate(name)
  }

  /**
   * Save current job and add stages to the pipeline.
   *
   * @param stages - One or more stage names
   * @returns ConfigBuilder instance
   *
   * @example
   * ```ts
   * config
   *   .addJob('build')
   *     .script('build.sh')
   *   .stages('build', 'test', 'deploy')
   * ```
   */
  stages(...stages: string[]): ConfigBuilder {
    this.save()
    return this.config.stages(...stages)
  }

  /**
   * Save current job and set global variables.
   *
   * @param vars - Global variables object
   * @returns ConfigBuilder instance
   *
   * @example
   * ```ts
   * config
   *   .addJob('build')
   *     .script('build.sh')
   *   .variables({ NODE_ENV: 'production' })
   * ```
   */
  variables(vars: Variables): ConfigBuilder {
    this.save()
    return this.config.variables(vars)
  }
}
