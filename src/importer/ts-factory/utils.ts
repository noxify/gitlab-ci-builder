/**
 * Known top-level keys in GitLab CI configuration
 */
const KNOWN_TOP_LEVEL_KEYS = [
  "stages",
  "workflow",
  "include",
  "variables",
  "default",
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
const SINGLE_VALUE_PROPERTIES = ["extends", "annotations", "dotenv"] as const

/**
 * Shell operator patterns that indicate script should stay as single string
 */
const SHELL_OPERATOR_PATTERNS = [
  /\\\n/, // Line continuation
  /<</, // Heredoc
  /(?<!\|)\|(?!\|)/, // Pipe (but not ||)
  />>?/, // Redirect output
  /2>/, // Redirect stderr
  /&>/, // Redirect both
  /(?<!<)<(?!<)/, // Redirect input (but not <<)
]

/**
 * Shell control structure patterns
 */
const SHELL_CONTROL_STRUCTURES = [
  /\bif\b.*\bthen\b/s, // if-then
  /\bcase\b.*\besac\b/s, // case-esac
  /\bfor\b.*\bdo\b/s, // for-do
  /\bwhile\b.*\bdo\b/s, // while-do
  /\buntil\b.*\bdo\b/s, // until-do
]

/**
 * Check if a value is a valid job definition
 */
export function isValidJobDefinition(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Check if a string contains shell-specific patterns
 */
export function hasShellOperators(value: string): boolean {
  return SHELL_OPERATOR_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Check if a string contains shell control structures
 */
export function hasControlStructures(value: string): boolean {
  return SHELL_CONTROL_STRUCTURES.some((pattern) => pattern.test(value))
}

/**
 * Separate parsed YAML into top-level config and jobs
 */
export function separateTopLevelAndJobs(parsed: Record<string, unknown>): {
  topLevel: Record<string, unknown>
  jobs: Record<string, unknown>
} {
  const topLevel: Record<string, unknown> = {}
  const jobs: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (KNOWN_TOP_LEVEL_KEYS.includes(key as (typeof KNOWN_TOP_LEVEL_KEYS)[number])) {
      topLevel[key] = value
    } else {
      jobs[key] = value
    }
  }

  return { topLevel, jobs }
}

/**
 * Categorize jobs into templates and regular jobs
 */
export function categorizeJobs(jobs: Record<string, unknown>): {
  templates: [string, Record<string, unknown>][]
  regularJobs: [string, Record<string, unknown>][]
} {
  const templates: [string, Record<string, unknown>][] = []
  const regularJobs: [string, Record<string, unknown>][] = []

  for (const [key, value] of Object.entries(jobs)) {
    if (!isValidJobDefinition(value)) continue

    if (key.startsWith(".")) {
      templates.push([key, value])
    } else {
      regularJobs.push([key, value])
    }
  }

  return { templates, regularJobs }
}

export { SCRIPT_PROPERTIES, SINGLE_VALUE_PROPERTIES }
