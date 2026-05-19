/**
 * Known top-level keys in GitLab CI configuration
 */
const KNOWN_TOP_LEVEL_KEYS = [
  "stages",
  "workflow",
  "include",
  "variables",
  "default",
  "spec",
  "image",
  "services",
  "before_script",
  "after_script",
  "cache",
] as const

/**
 * Properties that should be treated as script values
 */
const SCRIPT_PROPERTIES = ["script", "before_script", "after_script"] as const

/**
 * Properties that accept string | string[] but single values are more common
 */
const SINGLE_VALUE_PROPERTIES = [
  "extends",
  "image",
  "needs",
  "annotations",
  "dotenv",
] as const

/**
 * Shell operator patterns that indicate script should stay as single string
 */
const SHELL_OPERATOR_PATTERNS = [
  /\\\n/u, // Line continuation
  /<</u, // Heredoc
  /(?<!\|)\|(?!\|)/u, // Pipe (but not ||)
  />>?/u, // Redirect output
  /2>/u, // Redirect stderr
  /&>/u, // Redirect both
  /(?<!<)<(?!<)/u, // Redirect input (but not <<)
]

/**
 * Shell control structure patterns
 */
const SHELL_CONTROL_STRUCTURES = [
  /\bif\b.*\bthen\b/su, // if-then
  /\bcase\b.*\besac\b/su, // case-esac
  /\bfor\b.*\bdo\b/su, // for-do
  /\bwhile\b.*\bdo\b/su, // while-do
  /\buntil\b.*\bdo\b/su, // until-do
]

/**
 * Check if a value is a valid job definition.
 *
 * A valid job definition is a non-null object that is not an array.
 *
 * @param value - The value to check
 * @returns True if the value is a valid job definition
 *
 * @example
 * ```ts
 * isValidJobDefinition({ stage: 'build' }) // true
 * isValidJobDefinition('not a job') // false
 * isValidJobDefinition(['array']) // false
 * ```
 */
export function isValidJobDefinition(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Check if a string contains shell-specific patterns.
 *
 * Detects shell operators like pipes, redirects, and line continuations.
 *
 * @param value - The string to check
 * @returns True if shell operators are detected
 *
 * @example
 * ```ts
 * hasShellOperators('echo hello | grep hello') // true
 * hasShellOperators('echo hello > output.txt') // true
 * hasShellOperators('npm run build') // false
 * ```
 */
export function hasShellOperators(value: string): boolean {
  return SHELL_OPERATOR_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Check if a string contains shell control structures.
 *
 * Detects shell control structures like if/then, for/do, while/do, etc.
 *
 * @param value - The string to check
 * @returns True if control structures are detected
 *
 * @example
 * ```ts
 * hasControlStructures('if [ -f file ]; then echo "exists"; fi') // true
 * hasControlStructures('for i in 1 2 3; do echo $i; done') // true
 * hasControlStructures('npm run build') // false
 * ```
 */
export function hasControlStructures(value: string): boolean {
  return SHELL_CONTROL_STRUCTURES.some((pattern) => pattern.test(value))
}

/**
 * Separate parsed YAML into top-level config and jobs.
 *
 * Splits the parsed YAML into top-level keywords (stages, variables, etc.)
 * and job/template definitions.
 *
 * @param parsed - Parsed YAML object
 * @returns Object with topLevel and jobs properties
 *
 * @example
 * ```ts
 * const parsed = {
 *   stages: ['build', 'test'],
 *   variables: { NODE_VERSION: '18' },
 *   build: { stage: 'build', script: 'build.sh' }
 * }
 *
 * const { topLevel, jobs } = separateTopLevelAndJobs(parsed)
 * // topLevel: { stages: [...], variables: {...} }
 * // jobs: { build: {...} }
 * ```
 */
export function separateTopLevelAndJobs(parsed: Record<string, unknown>): {
  topLevel: Record<string, unknown>
  jobs: Record<string, unknown>
} {
  const topLevel: Record<string, unknown> = {}
  const jobs: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (
      KNOWN_TOP_LEVEL_KEYS.includes(
        key as (typeof KNOWN_TOP_LEVEL_KEYS)[number]
      )
    ) {
      topLevel[key] = value
    } else {
      jobs[key] = value
    }
  }

  return { topLevel, jobs }
}

/**
 * Categorize jobs into templates and regular jobs.
 *
 * Separates jobs based on whether their names start with a dot (templates)
 * or not (regular jobs).
 *
 * @param jobs - Map of job definitions
 * @returns Object with templates and regularJobs arrays
 *
 * @example
 * ```ts
 * const jobs = {
 *   '.base': { script: 'base.sh' },
 *   'build': { stage: 'build', script: 'build.sh' }
 * }
 *
 * const { templates, regularJobs } = categorizeJobs(jobs)
 * // templates: [['.base', {...}]]
 * // regularJobs: [['build', {...}]]
 * ```
 */
export function categorizeJobs(jobs: Record<string, unknown>): {
  templates: [string, Record<string, unknown>][]
  regularJobs: [string, Record<string, unknown>][]
} {
  const templates: [string, Record<string, unknown>][] = []
  const regularJobs: [string, Record<string, unknown>][] = []

  for (const [key, value] of Object.entries(jobs)) {
    if (!isValidJobDefinition(value)) {
      continue
    }

    if (key.startsWith(".")) {
      templates.push([key, value])
    } else {
      regularJobs.push([key, value])
    }
  }

  return { templates, regularJobs }
}

export { SCRIPT_PROPERTIES, SINGLE_VALUE_PROPERTIES }
