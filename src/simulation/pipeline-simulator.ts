import type { ConfigBuilder } from "../builder/config-builder"
import { resolveExtends } from "../resolver/builder"
import type { JobDefinitionNormalized } from "../schema/job"
import type { RuleContext } from "./rule-evaluator"
import { RuleEvaluator } from "./rule-evaluator"

/**
 * Result of a pipeline simulation
 */
export interface SimulationResult {
  jobs: JobSimulation[]
  totalJobs: number
  jobsToRun: number
  jobsSkipped: number
  stages: string[]
}

/**
 * Result of simulating a single job
 */
export interface JobSimulation {
  name: string
  stage: string
  shouldRun: boolean
  when: string
  reason?: string
}

/**
 * Simulates a GitLab CI pipeline based on rules and context
 */
export class PipelineSimulator {
  private readonly ruleEvaluator: RuleEvaluator

  constructor() {
    this.ruleEvaluator = new RuleEvaluator()
  }

  /**
   * Simulate a GitLab CI pipeline execution with rule evaluation.
   *
   * This method evaluates which jobs would run in a pipeline based on the provided
   * context (branch, variables, merge request status). It resolves all job extends,
   * merges configurations, and evaluates job rules to determine execution status.
   *
   * @param config - The ConfigBuilder instance containing the pipeline definition
   * @param context - The execution context with variables, branch, tags, and MR info
   * @param context.variables - Pipeline variables (CI_* and custom variables)
   * @param context.branch - Branch name (sets CI_COMMIT_BRANCH)
   * @param context.tag - Tag name (sets CI_COMMIT_TAG)
   * @param context.mergeRequestId - MR ID (sets CI_MERGE_REQUEST_ID)
   * @param context.mergeRequestLabels - MR labels array
   * @returns Simulation result with job execution status, stages, and skipped jobs
   *
   * @example
   * ```ts
   * import { ConfigBuilder, PipelineSimulator } from '@noxify/gitlab-ci-builder'
   *
   * const config = new ConfigBuilder()
   *   .stages('build', 'test', 'deploy')
   *   .job('build', { stage: 'build', script: ['npm run build'] })
   *   .job('deploy', {
   *     stage: 'deploy',
   *     script: ['deploy.sh'],
   *     rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }]
   *   })
   *
   * const simulator = new PipelineSimulator()
   * const result = simulator.simulate(config, {
   *   variables: { CI_COMMIT_BRANCH: 'main' },
   *   branch: 'main'
   * })
   *
   * console.log(result.jobs) // Shows which jobs will run
   * console.log(result.stages) // Stage execution summary
   * ```
   */
  simulate(config: ConfigBuilder, context: RuleContext): SimulationResult {
    const plain = config.getPlainObject({ skipValidation: true })
    const allJobs = plain.jobs ?? {}
    const stages = plain.stages ?? ["test"]

    // Merge global pipeline variables into context
    const globalVariables: Record<string, string> = {}
    if (plain.variables && typeof plain.variables === "object") {
      for (const [key, val] of Object.entries(plain.variables)) {
        globalVariables[key] =
          val && typeof val === "object" && "value" in val
            ? String(val.value)
            : String(val)
      }
    }

    // Global variables are available to all jobs
    // Context variables (CI_* vars from command line) override global variables
    const mergedContext: RuleContext = {
      ...context,
      variables: {
        ...globalVariables,
        ...context.variables,
      },
    }

    // getPlainObject() resolves templates (resolveTemplatesOnly: true by default)
    // but keeps job-to-job extends. For simulation, we need fully resolved jobs.
    // Normalize extends back to arrays and resolve again with resolveTemplatesOnly: false
    const jobs: Record<string, JobDefinitionNormalized> = {}
    const templates: Record<string, JobDefinitionNormalized> = {}

    for (const [name, def] of Object.entries(allJobs)) {
      const normalized = def as JobDefinitionNormalized

      // Normalize extends: string -> array for resolveExtends
      if (normalized.extends && typeof normalized.extends === "string") {
        normalized.extends = [normalized.extends]
      }

      if (name.startsWith(".")) {
        templates[name] = normalized
      } else {
        jobs[name] = normalized
      }
    }

    // Resolve job-to-job extends for complete job definitions
    const { resolved: resolvedJobs } = resolveExtends(
      jobs,
      templates,
      {}, // no job options
      {
        mergeExtends: true,
        mergeExisting: true,
        // IMPORTANT: resolve ALL extends, not just templates
        resolveTemplatesOnly: false,
        // IMPORTANT: merge remote extends for complete simulation
        mergeRemoteExtends: true,
        performanceMode: false,
        missingExtendsPolicy: "ignore",
      }
    )

    const simulations: JobSimulation[] = []

    // Process jobs in stage order
    for (const stage of stages) {
      const stageJobs = Object.entries(resolvedJobs)
        .filter(([name, _job]) => !PipelineSimulator.isTemplate(name))
        .filter(([_name, job]) => job.stage === stage)
        .filter(([_name, job]) =>
          PipelineSimulator.shouldIncludeJob(job as JobDefinitionNormalized)
        )

      for (const [name, job] of stageJobs) {
        const simulation = this.simulateJob(
          name,
          job as JobDefinitionNormalized,
          mergedContext
        )
        simulations.push(simulation)
      }
    }

    // Add jobs without explicit stage
    const jobsWithoutStage = Object.entries(resolvedJobs)
      .filter(([name, _job]) => !PipelineSimulator.isTemplate(name))
      .filter(([_name, job]) => !job.stage)
      .filter(([_name, job]) =>
        PipelineSimulator.shouldIncludeJob(job as JobDefinitionNormalized)
      )

    for (const [name, job] of jobsWithoutStage) {
      const simulation = this.simulateJob(
        name,
        job as JobDefinitionNormalized,
        mergedContext
      )
      simulations.push(simulation)
    }

    const jobsToRun = simulations.filter((s) => s.shouldRun).length
    const jobsSkipped = simulations.length - jobsToRun

    return {
      jobs: simulations,
      totalJobs: simulations.length,
      jobsToRun,
      jobsSkipped,
      stages,
    }
  }

  /**
   * Simulate a single job
   */
  private simulateJob(
    name: string,
    job: JobDefinitionNormalized,
    context: RuleContext
  ): JobSimulation {
    const stage = job.stage ?? "test"

    // Check if job has no script/run (incomplete job from includes)
    const hasScript = Boolean(job.script ?? job.run)
    if (!hasScript) {
      return {
        name,
        stage,
        shouldRun: false,
        when: "never",
        reason: "Job has no script (incomplete include merge)",
      }
    }

    // Merge job variables with global context variables
    // Job variables override global variables (GitLab behavior)
    const jobVariables: Record<string, string> = {}
    if (job.variables && typeof job.variables === "object") {
      for (const [key, val] of Object.entries(job.variables)) {
        // JobVariable can be string | number | boolean | { value: string, expand?: boolean }
        jobVariables[key] =
          val && typeof val === "object" && "value" in val
            ? String(val.value)
            : String(val)
      }
    }

    const jobContext: RuleContext = {
      ...context,
      variables: {
        ...context.variables,
        ...jobVariables,
      },
    }

    // Evaluate rules if present
    if (job.rules && Array.isArray(job.rules)) {
      const result = this.ruleEvaluator.evaluateRules(job.rules, jobContext)
      return {
        name,
        stage,
        shouldRun: result.shouldRun,
        when: result.when,
        reason: result.shouldRun ? undefined : "Rules didn't match",
      }
    }

    // Check only/except (legacy)
    if (job.only) {
      // Simplified: assume only doesn't match in simulation
      return {
        name,
        stage,
        shouldRun: false,
        when: "never",
        reason: "only: not supported in simulation",
      }
    }

    if (job.except) {
      // Simplified: assume except doesn't match in simulation
      return {
        name,
        stage,
        shouldRun: true,
        when: "on_success",
      }
    }

    // No rules - job runs by default
    return {
      name,
      stage,
      shouldRun: true,
      when: "on_success",
    }
  }

  private static isTemplate(name: string): boolean {
    return name.startsWith(".")
  }

  private static hasExecutableScript(job: JobDefinitionNormalized): boolean {
    return !!(job.script ?? job.run)
  }

  private static hasPipelineTriggerInNeeds(
    job: JobDefinitionNormalized
  ): boolean {
    if (!job.needs || !Array.isArray(job.needs)) {
      return false
    }
    return job.needs.some(
      (need) => typeof need === "object" && need !== null && "pipeline" in need
    )
  }

  private static hasConfigForNonDefaultStage(
    job: JobDefinitionNormalized
  ): boolean {
    if (!job.stage || job.stage === "test") {
      return false
    }
    return !!(
      (job.variables && Object.keys(job.variables).length > 0) ||
      (job.rules && job.rules.length > 0) ||
      job.image ||
      job.before_script ||
      job.after_script ||
      job.tags ||
      job.only ||
      job.except
    )
  }

  private static shouldIncludeJob(job: JobDefinitionNormalized): boolean {
    // A job must have at least one of these to be executable:
    // - script or run (actual commands to execute)
    // - trigger (child pipeline or multi-project pipeline)
    // - needs with pipeline keyword (parent-child pipeline trigger)
    // - release (create a GitLab release)
    // - pages (GitLab Pages deployment)
    return (
      this.hasExecutableScript(job) ||
      !!job.trigger ||
      !!job.release ||
      !!job.pages ||
      this.hasPipelineTriggerInNeeds(job) ||
      this.hasConfigForNonDefaultStage(job)
    )
  }
}
