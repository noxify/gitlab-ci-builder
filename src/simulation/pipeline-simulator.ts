import type { ConfigBuilder } from "../builder/ConfigBuilder"
import type { JobDefinitionNormalized } from "../schema"
import type { RuleContext } from "./rule-evaluator"
import { resolveExtends } from "../resolver/builder"
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
   * Simulate a pipeline execution
   */
  simulate(config: ConfigBuilder, context: RuleContext): SimulationResult {
    const plain = config.getPlainObject({ skipValidation: true })
    const allJobs = plain.jobs ?? {}
    const stages = plain.stages ?? ["test"]

    // Separate jobs and templates (templates start with .)
    const jobs: Record<string, JobDefinitionNormalized> = {}
    const templates: Record<string, JobDefinitionNormalized> = {}

    for (const [name, def] of Object.entries(allJobs)) {
      if (name.startsWith(".")) {
        templates[name] = def as JobDefinitionNormalized
      } else {
        jobs[name] = def as JobDefinitionNormalized
      }
    }

    // Resolve extends relationships to get complete job definitions
    const { resolved: resolvedJobs } = resolveExtends(
      jobs,
      templates,
      {}, // no job options
      {
        mergeExtends: true,
        mergeExisting: true,
        resolveTemplatesOnly: false,
        performanceMode: false,
        missingExtendsPolicy: "ignore",
      },
    )

    const simulations: JobSimulation[] = []

    // Helper to check if a job is a template (starts with .)
    const isTemplate = (name: string): boolean => name.startsWith(".")

    // Helper to check if a job should be included in simulation
    const shouldIncludeJob = (job: JobDefinitionNormalized): boolean => {
      // Include if job has script or run
      if (job.script ?? job.run) return true

      // Also include if job has variables but no script/run
      // These are likely disabled jobs from remote includes that should appear as skipped
      if (job.variables && Object.keys(job.variables).length > 0) return true

      // Skip everything else (pure templates without any content)
      return false
    }

    // Process jobs in stage order
    for (const stage of stages) {
      const stageJobs = Object.entries(resolvedJobs)
        .filter(([name, _job]) => !isTemplate(name))
        .filter(([_name, job]) => job.stage === stage)
        .filter(([_name, job]) => shouldIncludeJob(job as JobDefinitionNormalized))

      for (const [name, job] of stageJobs) {
        const simulation = this.simulateJob(name, job as JobDefinitionNormalized, context)
        simulations.push(simulation)
      }
    }

    // Add jobs without explicit stage
    const jobsWithoutStage = Object.entries(resolvedJobs)
      .filter(([name, _job]) => !isTemplate(name))
      .filter(([_name, job]) => !job.stage)
      .filter(([_name, job]) => shouldIncludeJob(job as JobDefinitionNormalized))

    for (const [name, job] of jobsWithoutStage) {
      const simulation = this.simulateJob(name, job as JobDefinitionNormalized, context)
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
    context: RuleContext,
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
        if (val && typeof val === "object" && "value" in val) {
          jobVariables[key] = String(val.value)
        } else {
          jobVariables[key] = String(val)
        }
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
}
