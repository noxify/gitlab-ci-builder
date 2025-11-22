import type { PipelineOutput } from "../model"
import type {
  Defaults,
  GlobalOptions,
  IncludeInput,
  JobDefinitionInput,
  JobDefinitionNormalized,
  JobOptions,
  ValidationError,
  Variables,
  Workflow,
} from "../schema"
import { mergeJobDefinitions } from "../merge"
import { PipelineState } from "../model"
import { resolveExtends } from "../resolution"
import { normalizeExtends, normalizeInclude } from "../schema"
import { serializeToYaml } from "../serializer"

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
   * Define pipeline stages
   */
  public stages(...stages: string[]): this {
    this.state.addStages(stages)
    return this
  }

  /**
   * Add a single stage
   */
  public addStage(stage: string): this {
    return this.stages(stage)
  }

  /**
   * Set global options
   */
  public globalOptions(options: Partial<GlobalOptions>): this {
    this.state.setGlobalOptions(options)
    return this
  }

  /**
   * Set or merge workflow configuration
   */
  public workflow(workflow: Workflow): this {
    const current = this.state.workflow
    if (current) {
      // Deep merge workflow - rules has default([]) so safe to spread
      const merged: Workflow = {
        ...current,
        ...workflow,
        rules: [...current.rules, ...workflow.rules],
      }
      this.state.setWorkflow(merged)
    } else {
      this.state.setWorkflow(workflow)
    }
    return this
  }

  /**
   * Set or merge default configuration
   */
  public defaults(defaults: Defaults): this {
    const current = this.state.defaults
    if (current) {
      // Deep merge defaults (using merge engine)
      const merged = mergeJobDefinitions(current, defaults) as Defaults
      this.state.setDefaults(merged)
    } else {
      this.state.setDefaults(defaults)
    }
    return this
  }

  /**
   * Set a single variable
   */
  public variable(key: string, value: string | number | boolean | undefined): this {
    this.state.setVariable(key, value)
    return this
  }

  /**
   * Set multiple variables
   */
  public variables(vars: Variables): this {
    const current = this.state.variables
    this.state.setVariables({ ...current, ...vars })
    return this
  }

  /**
   * Get a variable value
   */
  public getVariable(job: string, key: string): string | number | boolean | undefined {
    return this.state.getVariable(job, key)
  }

  /**
   * Get a job or template definition
   */
  public getJob(name: string): JobDefinitionInput | undefined {
    return this.state.getJob(name) as JobDefinitionInput | undefined
  }

  /**
   * Add include entries
   */
  public include(item: IncludeInput | IncludeInput[]): this {
    const items = Array.isArray(item) ? item : [item]

    for (const entry of items) {
      const normalized = normalizeInclude(entry)
      this.state.addInclude(normalized)
    }

    return this
  }

  /**
   * Define a template (hidden job starting with dot)
   */
  public template(name: string, definition: JobDefinitionInput, options: JobOptions = {}): this {
    // Ensure name starts with dot
    const templateName = name.startsWith(".") ? name : `.${name}`

    // Normalize extends
    const normalized = normalizeExtends(definition)

    // Check if template exists
    const existing = this.state.getJob(templateName)
    const mergeExisting = options.mergeExisting ?? this.state.globalOptions.mergeExisting

    if (existing && mergeExisting !== false) {
      // Merge with existing
      const merged = mergeJobDefinitions(existing, normalized)
      this.state.setTemplate(templateName, merged, options)
    } else {
      this.state.setTemplate(templateName, normalized, options)
    }

    return this
  }

  /**
   * Define a job or template
   */
  public job(name: string, definition: JobDefinitionInput, options: JobOptions = {}): this {
    // Normalize extends
    const normalized = normalizeExtends(definition)

    // Check if it should be treated as template
    if (name.startsWith(".") || options.hidden) {
      const templateName = name.startsWith(".") ? name : `.${name}`
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
   * Define a job that extends from one or more templates/jobs
   */
  public extends(
    fromName: string | string[],
    name: string,
    job?: JobDefinitionInput,
    options: JobOptions = {},
  ): this {
    const extendsArray = Array.isArray(fromName) ? fromName : [fromName]

    const definition: JobDefinitionInput = {
      ...(job ?? {}),
      extends: extendsArray,
    }

    return this.job(name, definition, options)
  }

  /**
   * Register a macro
   */
  public macro<TArgs extends MacroArgs>(key: string, callback: MacroFunction<TArgs>): this {
    if (this.macrosRegistry.has(key)) {
      throw new Error(`Macro ${key} already defined! You are not allowed to overwrite it.`)
    }

    this.macrosRegistry.set(key, callback as MacroFunction)
    return this
  }

  /**
   * Apply a macro
   */
  public from<TArgs extends MacroArgs>(key: string, args: TArgs): this {
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
   * Register a patcher callback
   */
  public patch(callback: PatcherFunction): this {
    this.patchersRegistry.push(callback)
    return this
  }

  /**
   * Dynamically include TypeScript configuration modules
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
   * Finalize the configuration and return the resolved pipeline
   */
  public finalize(): FinalizeResult {
    // Get current state
    const plain = this.state.toPlainObject()

    // Resolve extends
    const resolution = resolveExtends(
      this.state.jobs as Record<string, JobDefinitionNormalized>,
      this.state.templates as Record<string, JobDefinitionNormalized>,
      this.state.jobOptionsMap,
      this.state.globalOptions,
    )

    // Build final output
    const pipeline: PipelineOutput = {
      stages: plain.stages,
      workflow: plain.workflow,
      default: plain.default,
      variables: plain.variables,
      include: plain.include,
      jobs: resolution.resolved,
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
   * Get plain object (for backward compatibility)
   * Same as finalize().pipeline but without validation metadata
   */
  public getPlainObject(): PipelineOutput {
    const result = this.finalize()

    // Throw if there are errors (for backward compatibility)
    if (result.errors.length > 0) {
      const errorMessages = result.errors.map((e) => e.message).join("\n")
      throw new Error(`Pipeline validation failed:\n${errorMessages}`)
    }

    return result.pipeline
  }

  /**
   * JSON.stringify helper
   */
  public toJSON(): PipelineOutput {
    return this.getPlainObject()
  }

  /**
   * Serialize the pipeline to YAML string
   */
  public toYaml(): string {
    const pipeline = this.getPlainObject()
    return serializeToYaml(pipeline)
  }

  /**
   * Write the pipeline configuration to a YAML file
   */
  public async writeYamlFile(
    filePath: string,
    options?: { encoding?: BufferEncoding },
  ): Promise<void> {
    const fs = await import("fs/promises")
    const content = this.toYaml()
    await fs.writeFile(filePath, content, { encoding: options?.encoding ?? "utf8" })
  }
}

/**
 * Export type-safe helper for simpler pipeline output type
 */
export type Pipeline = PipelineOutput
