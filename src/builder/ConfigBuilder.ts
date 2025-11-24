import fs from "fs/promises"

import type { PipelineOutput } from "../model"
import type { ExtendsGraphNode, VisualizationOptions } from "../resolution"
import type {
  Defaults,
  GlobalOptions,
  IncludeInput,
  JobDefinitionInput,
  JobDefinitionNormalized,
  JobDefinitionOutput,
  JobOptions,
  Spec,
  ValidationError,
  Variables,
  Workflow,
} from "../schema"
import { mergeJobDefinitions } from "../merge"
import { PipelineState } from "../model"
import {
  buildExtendsGraph,
  generateAsciiTree,
  generateMermaidDiagram,
  generateStageTable,
} from "../resolution"
import { resolveExtends } from "../resolver"
import {
  DefaultsSchema,
  IncludeSchema,
  JobDefinitionParseSchema,
  SpecSchema,
  WorkflowSchema,
} from "../schema"
import { serializeToYaml } from "../serializer"
import { JobBuilder } from "./JobBuilder"

/**
 * Reserved top-level keywords that cannot be used as job names
 * @see https://docs.gitlab.com/ee/ci/yaml/#keywords
 */
const RESERVED_JOB_NAMES = new Set([
  "default",
  "include",
  "stages",
  "variables",
  "workflow",
  "spec",
])

/**
 * Macro args type
 */
export type MacroArgs = unknown

/**
 * Macro function type
 */
export type MacroFunction<TArgs extends MacroArgs = MacroArgs> = (
  config: ConfigBuilder,
  args: TArgs,
) => void

/**
 * Async config extension function (for dynamic includes)
 */
export type ExtendConfigFunction = (config: ConfigBuilder) => ConfigBuilder | Promise<ConfigBuilder>

/**
 * Patcher function (for last-minute adjustments)
 */
export type PatcherFunction = (plain: PipelineOutput) => void

/**
 * Finalize result with validation metadata
 */
export interface FinalizeResult {
  pipeline: PipelineOutput
  errors: ValidationError[]
  warnings: ValidationError[]
  metadata: {
    skippedChecks: string[]
  }
}

/**
 * Safe validation result
 */
export interface SafeValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * ConfigBuilder - Fluent API for building GitLab CI pipelines
 *
 * This is the main entry point for the refactored implementation.
 * It maintains backward compatibility with the original Config class API.
 */
export class ConfigBuilder {
  private state: PipelineState
  private macrosRegistry = new Map<string, MacroFunction>()
  private patchersRegistry: PatcherFunction[] = []

  constructor(globalOptions?: Partial<GlobalOptions>) {
    this.state = new PipelineState(globalOptions)
  }

  /**
   * Define pipeline stages.
   *
   * Stages define the execution order of jobs in the pipeline. Jobs in the same
   * stage run in parallel, while stages run sequentially.
   *
   * @param stages - One or more stage names to add to the pipeline
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test', 'deploy')
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#stages
   */
  public stages(...stages: string[]) {
    this.state.addStages(stages)
    return this
  }

  /**
   * Add a single stage to the pipeline.
   *
   * This is a convenience method equivalent to calling `stages()` with a single argument.
   *
   * @param stage - The stage name to add
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .addStage('build')
   *   .addStage('test')
   * ```
   */
  public addStage(stage: string) {
    return this.stages(stage)
  }

  /**
   * Set global options for the configuration builder.
   *
   * Global options control how the builder processes jobs, templates, and extends relationships.
   *
   * @param options - Global configuration options
   * @param options.mergeExtends - Whether to merge extends chains (default: true)
   * @param options.mergeExisting - Whether to merge with existing jobs when adding duplicates (default: true)
   * @param options.resolveTemplatesOnly - Only resolve template extends, keep job extends (default: true)
   * @param options.performanceMode - Skip expensive validation checks (default: false)
   * @param options.missingExtendsPolicy - How to handle missing extends targets: 'error', 'warn', or 'ignore' (default: 'warn')
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .globalOptions({
   *     mergeExtends: false,
   *     missingExtendsPolicy: 'error'
   *   })
   * ```
   */
  public globalOptions(options: Partial<GlobalOptions>) {
    this.state.setGlobalOptions(options)
    return this
  }

  /**
   * Set or merge workflow configuration.
   *
   * Workflow controls when pipelines are created and defines global pipeline rules.
   *
   * @param workflow - Workflow configuration object
   * @param workflow.rules - Array of rules to determine when the pipeline runs
   * @param workflow.name - Pipeline name (for visualizations)
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .workflow({
   *     rules: [
   *       { if: '$CI_PIPELINE_SOURCE == "merge_request_event"' },
   *       { if: '$CI_COMMIT_BRANCH == "main"' }
   *     ]
   *   })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#workflow
   */
  public workflow(workflow: Workflow) {
    const validated = WorkflowSchema.parse(workflow)
    const current = this.state.workflow
    if (current) {
      // Deep merge workflow - rules has default([]) so safe to spread
      const merged: Workflow = {
        ...current,
        ...validated,
        rules: [...current.rules, ...validated.rules],
      }
      this.state.setWorkflow(merged)
    } else {
      this.state.setWorkflow(validated)
    }
    return this
  }

  /**
   * Set or merge default configuration for all jobs.
   *
   * Defaults define common properties that are inherited by all jobs unless overridden.
   *
   * @param defaults - Default job properties
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .defaults({
   *     image: 'node:18',
   *     cache: {
   *       paths: ['node_modules/']
   *     },
   *     before_script: ['npm ci']
   *   })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#default
   */
  public defaults(defaults: Defaults) {
    const validated = DefaultsSchema.parse(defaults)
    const current = this.state.defaults
    if (current) {
      // Deep merge defaults (using merge engine)
      const merged = mergeJobDefinitions(current, validated)
      // Re-validate after merge to ensure type compatibility
      const revalidated = DefaultsSchema.parse(merged) as Defaults
      this.state.setDefaults(revalidated)
    } else {
      this.state.setDefaults(validated as Defaults)
    }
    return this
  }

  /**
   * Set a single global variable.
   *
   * Variables are available to all jobs in the pipeline and can be used in scripts
   * and other configuration values.
   *
   * @param key - Variable name
   * @param value - Variable value (string, number, boolean, or undefined)
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .variable('NODE_VERSION', '18')
   *   .variable('DEPLOY_ENV', 'production')
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#variables
   */
  public variable(key: string, value: string | number | boolean | undefined) {
    this.state.setVariable(key, value)
    return this
  }

  /**
   * Set multiple global variables at once.
   *
   * Variables are merged with existing variables, with new values overwriting existing ones.
   *
   * @param vars - Object containing variable key-value pairs
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .variables({
   *     NODE_VERSION: '18',
   *     DEPLOY_ENV: 'production',
   *     CACHE_KEY: 'v1'
   *   })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#variables
   */
  public variables(vars: Variables) {
    const current = this.state.variables
    this.state.setVariables({ ...current, ...vars })
    return this
  }

  /**
   * Get a variable value for a specific job.
   *
   * Looks up the variable value, checking first in job-specific variables,
   * then falling back to global variables.
   *
   * @param job - The job name to check
   * @param key - The variable name to retrieve
   * @returns The variable value, or undefined if not found
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .variables({ GLOBAL_VAR: 'global' })
   *   .job('test', {
   *     variables: { JOB_VAR: 'job-specific' },
   *     script: 'echo test'
   *   })
   *
   * const value = config.getVariable('test', 'JOB_VAR') // Returns 'job-specific'
   * const global = config.getVariable('test', 'GLOBAL_VAR') // Returns 'global'
   * ```
   */
  public getVariable(job: string, key: string): string | number | boolean | undefined {
    return this.state.getVariable(job, key)
  }

  /**
   * Get a job or template definition by name.
   *
   * Returns the raw job/template definition before extends resolution.
   *
   * @param name - The job or template name
   * @returns The job/template definition, or undefined if not found
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .template('.deploy-template', { script: 'deploy.sh' })
   *   .job('deploy:prod', {
   *     extends: '.deploy-template',
   *     stage: 'deploy'
   *   })
   *
   * const template = config.getJob('.deploy-template')
   * const job = config.getJob('deploy:prod')
   * ```
   */
  public getJob(name: string): JobDefinitionInput | undefined {
    return this.state.getJob(name) as JobDefinitionInput | undefined
  }

  /**
   * Add include entries to import external configuration.
   *
   * Includes allow you to split configuration across multiple files or import
   * templates from other projects, URLs, or GitLab CI/CD templates.
   *
   * @param item - Single include entry or array of include entries
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * // Include local file
   * const config = new ConfigBuilder()
   *   .include({ local: '.gitlab/ci/build.yml' })
   * ```
   *
   * @example
   * ```ts
   * // Include remote file
   * config.include({
   *   remote: 'https://example.com/ci/template.yml'
   * })
   * ```
   *
   * @example
   * ```ts
   * // Include GitLab template
   * config.include({ template: 'Security/SAST.gitlab-ci.yml' })
   * ```
   *
   * @example
   * ```ts
   * // Include from another project
   * config.include({
   *   project: 'my-group/my-project',
   *   file: '/templates/.gitlab-ci-template.yml',
   *   ref: 'main'
   * })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#include
   */
  public include(item: IncludeInput | IncludeInput[]) {
    const items = Array.isArray(item) ? item : [item]

    for (const entry of items) {
      const normalized = IncludeSchema.parse(entry)
      this.state.addInclude(normalized)
    }

    return this
  }

  /**
   * Set spec configuration (pipeline inputs for CI/CD components).
   *
   * Spec defines input variables that can be provided when the pipeline is used
   * as a component in other projects.
   *
   * @param spec - Spec configuration object
   * @param spec.inputs - Input parameter definitions
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .spec({
   *     inputs: {
   *       environment: {
   *         default: 'production',
   *         description: 'Deployment environment'
   *       },
   *       version: {
   *         description: 'Application version to deploy'
   *       }
   *     }
   *   })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#spec
   */
  public spec(spec: Spec) {
    const validated = SpecSchema.parse(spec)
    this.state.setSpec(validated)
    return this
  }

  /**
   * Define a template (hidden job starting with dot)
  }

  /**
   * Define a template (hidden job starting with dot)
   *
   * Templates default to `mergeExtends: false` to preserve extends references
   * in the template definition, allowing proper resolution when jobs extend from it.
   */
  public template(name: string, definition: JobDefinitionInput, options: JobOptions = {}) {
    // Ensure name starts with dot
    const templateName = name.startsWith(".") ? name : `.${name}`

    // Templates default to mergeExtends: false unless explicitly overridden
    const templateOptions: JobOptions = {
      ...options,
      mergeExtends: options.mergeExtends ?? false,
    }

    // Parse and normalize (extends is automatically normalized to array)
    const normalized = JobDefinitionParseSchema.parse(definition)

    // Check if template exists
    const existing = this.state.getJob(templateName)
    const mergeExisting = options.mergeExisting ?? this.state.globalOptions.mergeExisting

    if (existing && mergeExisting !== false) {
      // Merge with existing
      const merged = mergeJobDefinitions(existing, normalized)
      this.state.setTemplate(templateName, merged, templateOptions)
    } else {
      this.state.setTemplate(templateName, normalized, templateOptions)
    }

    return this
  }

  /**
   * Add a job with fluent builder interface.
   *
   * Returns a JobBuilder instance that provides chainable methods for defining job properties.
   * Call `.done()` or start a new job to finalize and return to ConfigBuilder.
   *
   * @param name - The job name
   * @returns JobBuilder instance for fluent job definition
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test')
   *   .addJob('build')
   *     .stage('build')
   *     .image('node:18')
   *     .script(['npm ci', 'npm run build'])
   *     .artifacts({ paths: ['dist/'] })
   *     .done()
   * ```
   *
   * @example
   * ```ts
   * // Chain multiple jobs
   * config
   *   .addJob('lint')
   *     .stage('test')
   *     .script('npm run lint')
   *   .addJob('test')
   *     .stage('test')
   *     .script('npm test')
   *     .done()
   * ```
   */
  public addJob(name: string): JobBuilder {
    return new JobBuilder(name, this, false)
  }

  /**
   * Add a template with fluent builder interface.
   *
   * Returns a JobBuilder instance for defining a template (hidden job).
   * Templates are reusable job definitions that can be extended by other jobs.
   *
   * @param name - The template name (will be prefixed with '.' if not already)
   * @returns JobBuilder instance for fluent template definition
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .addTemplate('.docker-build')
   *     .image('docker:latest')
   *     .services(['docker:dind'])
   *     .before_script(['docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD'])
   *     .done()
   * ```
   */
  public addTemplate(name: string): JobBuilder {
    const templateName = name.startsWith(".") ? name : `.${name}`
    return new JobBuilder(templateName, this, true)
  }

  /**
   * Define a job or template.
   *
   * Jobs are the building blocks of a pipeline. Each job defines a specific task to execute.
   * Jobs starting with a dot (.) are treated as templates and won't run unless extended.
   *
   * @param name - Job or template name (templates should start with '.')
   * @param definition - Job configuration
   * @param options - Job-specific options
   * @param options.hidden - Treat as template even without dot prefix
   * @param options.mergeExisting - Merge with existing job definition (default: from globalOptions)
   * @param options.mergeExtends - Merge extends chains (default: from globalOptions)
   * @param options.resolveTemplatesOnly - Only resolve template extends (default: from globalOptions)
   * @param options.remote - Mark as remote job from include (used for visualization)
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test')
   *   .job('build:app', {
   *     stage: 'build',
   *     script: ['npm ci', 'npm run build'],
   *     artifacts: {
   *       paths: ['dist/']
   *     }
   *   })
   * ```
   *
   * @example
   * ```ts
   * // Define a template
   * config.job('.deploy-template', {
   *   script: 'deploy.sh',
   *   only: ['main']
   * })
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#job-keywords
   */
  public job(name: string, definition: JobDefinitionInput, options: JobOptions = {}) {
    // Validate job name is not a reserved keyword
    if (RESERVED_JOB_NAMES.has(name)) {
      throw new Error(
        `Job name "${name}" is a reserved keyword and cannot be used as a job name. Reserved keywords: ${[...RESERVED_JOB_NAMES].join(", ")}`,
      )
    }

    // Parse and normalize (extends is automatically normalized to array)
    const normalized = JobDefinitionParseSchema.parse(definition)

    // Check if it should be treated as template
    if (name.startsWith(".") || options.hidden) {
      const templateName = name.startsWith(".") ? name : `.${name}`
      // Delegate to template() which applies template defaults
      return this.template(templateName, definition, options)
    }

    // Check if job exists
    const existing = this.state.getJob(name)
    const mergeExisting = options.mergeExisting ?? this.state.globalOptions.mergeExisting

    if (existing && mergeExisting !== false) {
      // Merge with existing
      const merged = mergeJobDefinitions(existing, normalized)
      this.state.setJob(name, merged, options)
    } else {
      this.state.setJob(name, normalized, options)
    }

    return this
  }

  /**
   * Define a job that extends from one or more templates/jobs.
   *
   * This is a convenience method for creating jobs with extends relationships.
   * It's equivalent to calling `job()` with an extends property.
   *
   * @param fromName - Template/job name(s) to extend from (single string or array)
   * @param name - Name of the new job
   * @param job - Additional job configuration (optional)
   * @param options - Job-specific options
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .template('.deploy-template', {
   *     script: 'deploy.sh'
   *   })
   *   .extends('.deploy-template', 'deploy:prod', {
   *     stage: 'deploy',
   *     environment: 'production'
   *   })
   * ```
   *
   * @example
   * ```ts
   * // Extend from multiple templates
   * config.extends(
   *   ['.docker-template', '.deploy-template'],
   *   'deploy:staging',
   *   { environment: 'staging' }
   * )
   * ```
   *
   * @see https://docs.gitlab.com/ee/ci/yaml/#extends
   */
  public extends(
    fromName: string | string[],
    name: string,
    job?: JobDefinitionInput,
    options: JobOptions = {},
  ) {
    const extendsArray = Array.isArray(fromName) ? fromName : [fromName]

    const definition: JobDefinitionInput = {
      ...(job ?? {}),
      extends: extendsArray,
    }

    return this.job(name, definition, options)
  }

  /**
   * Register a reusable macro function.
   *
   * Macros allow you to encapsulate common configuration patterns and reuse them
   * throughout your pipeline. They can accept arguments for customization.
   *
   * @param key - Unique macro identifier
   * @param callback - Function that modifies the config
   * @returns The ConfigBuilder instance for method chaining
   * @throws {Error} If a macro with the same key already exists
   *
   * @example
   * ```ts
   * interface DeployArgs {
   *   environment: string
   *   url: string
   * }
   *
   * const config = new ConfigBuilder()
   *   .macro<DeployArgs>('deploy', (config, args) => {
   *     config.job(`deploy:${args.environment}`, {
   *       stage: 'deploy',
   *       script: `deploy.sh ${args.environment}`,
   *       environment: {
   *         name: args.environment,
   *         url: args.url
   *       }
   *     })
   *   })
   *   .from('deploy', { environment: 'production', url: 'https://prod.example.com' })
   *   .from('deploy', { environment: 'staging', url: 'https://staging.example.com' })
   * ```
   */
  public macro<TArgs extends MacroArgs>(key: string, callback: MacroFunction<TArgs>) {
    if (this.macrosRegistry.has(key)) {
      throw new Error(`Macro ${key} already defined! You are not allowed to overwrite it.`)
    }

    this.macrosRegistry.set(key, callback as MacroFunction)
    return this
  }

  /**
   * Apply a previously registered macro.
   *
   * Executes the macro function with the provided arguments to modify the configuration.
   *
   * @param key - The macro identifier
   * @param args - Arguments to pass to the macro function
   * @returns The ConfigBuilder instance for method chaining
   * @throws {Error} If the macro is not registered
   *
   * @example
   * ```ts
   * config
   *   .macro<{ stage: string }>('test-job', (config, args) => {
   *     config.job('test', {
   *       stage: args.stage,
   *       script: 'npm test'
   *     })
   *   })
   *   .from('test-job', { stage: 'test' })
   * ```
   */
  public from<TArgs extends MacroArgs>(key: string, args: TArgs) {
    const macro = this.macrosRegistry.get(key)

    if (!macro) {
      throw new Error(
        `Macro ${key} not found, please register it with Config#macro! Consider also, that you need to register the macro before you execute from it.`,
      )
    }

    macro(this, args)
    return this
  }

  /**
   * Register a patcher callback for last-minute modifications.
   *
   * Patchers run after all configuration is built and extends are resolved,
   * allowing you to make final adjustments to the generated YAML structure.
   *
   * @param callback - Function that receives the finalized pipeline object
   * @returns The ConfigBuilder instance for method chaining
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test')
   *   .job('build', { stage: 'build', script: 'build.sh' })
   *   .patch((pipeline) => {
   *     // Add a custom property to all jobs
   *     if (pipeline.jobs) {
   *       for (const job of Object.values(pipeline.jobs)) {
   *         job.retry = { max: 2 }
   *       }
   *     }
   *   })
   * ```
   */
  public patch(callback: PatcherFunction) {
    this.patchersRegistry.push(callback)
    return this
  }

  /**
   * Dynamically include TypeScript configuration modules using glob patterns.
   *
   * This allows you to split your pipeline configuration across multiple TypeScript files
   * and import them dynamically. Each file should export a function (default or named `extendConfig`)
   * that accepts and modifies a ConfigBuilder instance.
   *
   * @param cwd - Working directory for resolving glob patterns
   * @param globs - Array of glob patterns to match configuration files
   * @returns Promise that resolves to the ConfigBuilder instance
   * @throws {Error} If a file doesn't export the required function
   *
   * @example
   * ```ts
   * // src/ci/build-jobs.ts
   * export default function(config: ConfigBuilder) {
   *   return config.job('build', {
   *     stage: 'build',
   *     script: 'npm run build'
   *   })
   * }
   *
   * // src/ci/index.ts
   * const config = await new ConfigBuilder()
   *   .stages('build', 'test', 'deploy')
   *   .dynamicInclude(process.cwd(), ['src/ci/*-jobs.ts'])
   * ```
   *
   * @example
   * ```ts
   * // Using named export
   * // src/ci/test-config.ts
   * export function extendConfig(config: ConfigBuilder) {
   *   return config.job('test', {
   *     stage: 'test',
   *     script: 'npm test'
   *   })
   * }
   * ```
   */
  public async dynamicInclude(cwd: string, globs: string[]): Promise<this> {
    const { globSync } = await import("tinyglobby")

    for (const glob of globs) {
      const files = globSync(glob, {
        absolute: true,
        cwd,
        dot: true,
      })

      for (const file of files) {
        const exported = (await import(file)) as
          | { default?: ExtendConfigFunction; extendConfig?: ExtendConfigFunction }
          | undefined

        // Prefer default export, fallback to named extendConfig
        const extendFn = exported?.default ?? exported?.extendConfig

        if (!extendFn) {
          throw new Error(`Please export a default function or a named "extendConfig" function!`)
        }

        if (!(extendFn instanceof Function)) {
          throw new Error(`The exported function is not a function!`)
        }

        // Call the function and await the result
        await extendFn(this)
      }
    }

    return this
  }

  /**
   * Finalize the configuration and return the resolved pipeline with validation metadata
   *
   * This is an internal method. Use {@link safeValidate} for programmatic validation
   * or {@link validate} for validation that throws errors.
   */
  private finalize(): FinalizeResult {
    // Get current state
    const plain = this.state.toPlainObject()

    // Resolve extends
    const resolution = resolveExtends(
      this.state.jobs as Record<string, JobDefinitionNormalized>,
      this.state.templates as Record<string, JobDefinitionNormalized>,
      this.state.jobOptionsMap,
      this.state.globalOptions,
    )

    // Normalize extends in resolved jobs (convert single-element arrays to strings)
    const normalizedJobs: Record<string, JobDefinitionOutput> = {}
    for (const [name, job] of Object.entries(resolution.resolved)) {
      if (job.extends && Array.isArray(job.extends) && job.extends.length === 1) {
        normalizedJobs[name] = {
          ...job,
          extends: job.extends[0],
        } as JobDefinitionOutput
      } else {
        normalizedJobs[name] = job
      }
    }

    // Build final output
    const pipeline: PipelineOutput = {
      spec: plain.spec,
      stages: plain.stages,
      workflow: plain.workflow,
      default: plain.default,
      variables: plain.variables,
      include: plain.include,
      jobs: normalizedJobs,
    }

    // Apply patchers
    for (const patcher of this.patchersRegistry) {
      patcher(pipeline)
    }

    return {
      pipeline,
      errors: resolution.errors,
      warnings: resolution.warnings,
      metadata: {
        skippedChecks: resolution.skippedChecks,
      },
    }
  }

  /**
   * Validate the pipeline configuration without throwing errors
   *
   * Returns validation result with errors and warnings. Use this method for
   * programmatic validation checks, testing, or when you want to handle
   * validation errors yourself.
   *
   * To get the pipeline after validation, use `getPlainObject({ skipValidation: true })`.
   *
   * @returns Validation result with valid flag, errors, and warnings
   *
   * @example
   * ```ts
   * const result = config.safeValidate()
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors)
   *   return
   * }
   * if (result.warnings.length > 0) {
   *   console.warn('Warnings:', result.warnings)
   * }
   * const pipeline = config.getPlainObject({ skipValidation: true })
   * ```
   */
  public safeValidate(): SafeValidationResult {
    const result = this.finalize()

    return {
      valid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
    }
  }

  /**
   * Validate the pipeline configuration
   *
   * Performs validation and logs warnings to console.
   *
   * @throws {Error} If validation fails
   *
   * @example
   * ```ts
   * config.validate()
   * const pipeline = config.getPlainObject({ skipValidation: true })
   * ```
   */
  public validate(): void {
    const result = this.finalize()

    // Log warnings to console
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        // eslint-disable-next-line no-console
        console.warn(`[GitLab CI Builder] ${warning.message}`)
      }
    }

    // Throw if there are errors
    if (result.errors.length > 0) {
      const errorMessages = result.errors.map((e) => e.message).join("\n")
      throw new Error(`Pipeline validation failed:\n${errorMessages}`)
    }
  }

  /**
   * Get plain object representation of the pipeline
   *
   * By default, validates the pipeline before returning it. Set `skipValidation: true`
   * if you've already called `validate()` separately for performance optimization.
   *
   * @param options - Configuration options
   * @param options.skipValidation - Skip validation (default: false). Use this if you've already called validate() separately.
   * @returns The pipeline configuration
   * @throws {Error} If validation fails and skipValidation is false
   *
   * @example
   * ```ts
   * // With validation (default - recommended)
   * const pipeline = config.getPlainObject()
   *
   * // Skip validation (performance optimization)
   * config.validate()
   * const pipeline = config.getPlainObject({ skipValidation: true })
   * ```
   */
  public getPlainObject(options?: { skipValidation?: boolean }): PipelineOutput {
    if (options?.skipValidation !== true) {
      this.validate()
    }
    return this.finalize().pipeline
  }

  /**
   * JSON.stringify helper
   *
   * @param options - Configuration options
   * @param options.skipValidation - Skip validation (default: false)
   */
  public toJSON(options?: { skipValidation?: boolean }): PipelineOutput {
    return this.getPlainObject(options)
  }

  /**
   * Serialize the pipeline configuration to a YAML string.
   *
   * By default, validates the pipeline before serialization. Set `skipValidation: true`
   * if you've already called `validate()` separately.
   *
   * @param options - Configuration options
   * @param options.skipValidation - Skip validation (default: false)
   * @returns YAML string representation of the pipeline
   * @throws {Error} If validation fails and skipValidation is false
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test')
   *   .job('build', { stage: 'build', script: 'build.sh' })
   *
   * const yaml = config.toYaml()
   * console.log(yaml)
   * ```
   *
   * @example
   * ```ts
   * // Skip validation for performance
   * config.validate()
   * const yaml = config.toYaml({ skipValidation: true })
   * ```
   */
  public toYaml(options?: { skipValidation?: boolean }): string {
    const pipeline = this.getPlainObject(options)
    return serializeToYaml(pipeline)
  }

  /**
   * Write the pipeline configuration to a YAML file.
   *
   * Validates the configuration and writes it to the specified file path.
   *
   * @param filePath - Destination file path (e.g., '.gitlab-ci.yml')
   * @param options - Write options
   * @param options.encoding - File encoding (default: 'utf8')
   * @returns Promise that resolves when the file is written
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test')
   *   .job('build', { stage: 'build', script: 'build.sh' })
   *
   * await config.writeYamlFile('.gitlab-ci.yml')
   * ```
   */
  public async writeYamlFile(
    filePath: string,
    options?: { encoding?: BufferEncoding },
  ): Promise<void> {
    const content = this.toYaml()
    await fs.writeFile(filePath, content, { encoding: options?.encoding ?? "utf8" })
  }

  /**
   * Get the extends dependency graph for visualization and analysis.
   *
   * Returns a graph structure showing all jobs, templates, and their extends relationships.
   * Useful for understanding pipeline structure and debugging extends chains.
   *
   * @returns Map of job/template names to their graph nodes
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .template('.base', { script: 'base.sh' })
   *   .job('test', { extends: '.base', stage: 'test' })
   *
   * const graph = config.getExtendsGraph()
   * for (const [name, node] of graph) {
   *   console.log(`${name} extends:`, node.extends)
   * }
   * ```
   */
  public getExtendsGraph(): Map<string, ExtendsGraphNode> {
    const jobs = this.state.jobs
    const templates = this.state.templates
    const jobOptionsMap = this.state.jobOptionsMap

    return buildExtendsGraph(jobs, templates, jobOptionsMap)
  }

  /**
   * Generate a Mermaid diagram from the extends graph.
   *
   * Creates a visual flowchart representation of jobs, templates, and their relationships.
   * The diagram can be rendered in Markdown files or Mermaid-compatible viewers.
   *
   * @param options - Visualization options
   * @param options.showStages - Show stage information (default: false)
   * @param options.showRemote - Show remote job indicators (default: false)
   * @returns Mermaid diagram syntax as a string
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test', 'deploy')
   *   .template('.deploy', { script: 'deploy.sh' })
   *   .job('deploy:prod', { extends: '.deploy', stage: 'deploy' })
   *
   * const diagram = config.generateMermaidDiagram({ showStages: true })
   * console.log(diagram)
   * // Can be used in README.md:
   * // ```mermaid
   * // [diagram content]
   * // ```
   * ```
   */
  public generateMermaidDiagram(options?: VisualizationOptions): string {
    const graph = this.getExtendsGraph()
    const resolvedConfig = this.getPlainObject({ skipValidation: true })
    return generateMermaidDiagram({ graph, resolvedConfig, options })
  }

  /**
   * Generate an ASCII tree diagram from the extends graph.
   *
   * Creates a text-based tree view of jobs, templates, and their inheritance hierarchy.
   * Useful for console output and documentation.
   *
   * @param options - Visualization options
   * @param options.showStages - Show stage information (default: false)
   * @param options.showRemote - Show remote job indicators (default: false)
   * @returns ASCII tree representation as a string
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .template('.base', { script: 'base.sh' })
   *   .template('.docker', { extends: '.base', image: 'docker:latest' })
   *   .job('build', { extends: '.docker', stage: 'build' })
   *
   * const tree = config.generateAsciiTree({ showStages: true })
   * console.log(tree)
   * // Output:
   * // build (build)
   * // └── .docker [T]
   * //     └── .base [T]
   * ```
   */
  public generateAsciiTree(options?: VisualizationOptions): string {
    const graph = this.getExtendsGraph()
    const resolvedConfig = this.getPlainObject({ skipValidation: true })
    return generateAsciiTree({ graph, resolvedConfig, options })
  }

  /**
   * Generate a stage table showing jobs grouped by stage.
   *
   * Creates a formatted table view of the pipeline showing which jobs run in each stage
   * and their extends relationships.
   *
   * @param options - Visualization options
   * @param options.showStages - Show stage column (default: false)
   * @param options.showRemote - Show remote job indicators (default: false)
   * @returns Formatted table as a string
   *
   * @example
   * ```ts
   * const config = new ConfigBuilder()
   *   .stages('build', 'test', 'deploy')
   *   .job('build:app', { stage: 'build', script: 'build.sh' })
   *   .job('test:unit', { stage: 'test', script: 'test.sh' })
   *   .job('deploy:prod', { stage: 'deploy', script: 'deploy.sh' })
   *
   * const table = config.generateStageTable()
   * console.log(table)
   * // Output:
   * // ┌─────────┬─────────────┐
   * // │ STAGE   │ JOB         │
   * // ├─────────┼─────────────┤
   * // │ build   │ build:app   │
   * // │ test    │ test:unit   │
   * // │ deploy  │ deploy:prod │
   * // └─────────┴─────────────┘
   * ```
   */
  public generateStageTable(options?: VisualizationOptions): string {
    const graph = this.getExtendsGraph()
    const resolvedConfig = this.getPlainObject({ skipValidation: true })
    return generateStageTable({ graph, resolvedConfig, options })
  }
}

/**
 * Export type-safe helper for simpler pipeline output type
 */
export type Pipeline = PipelineOutput
