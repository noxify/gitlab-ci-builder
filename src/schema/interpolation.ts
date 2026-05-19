import { z } from "zod"

/**
 * GitLab CI interpolation patterns that should be accepted as valid values
 * @see https://docs.gitlab.com/ci/yaml/inputs.html#use-inputs-in-the-same-file
 */
const GITLAB_INTERPOLATION_PATTERNS = [
  /^\$\[\[.*?\]\]$/u, // $[[ ... ]] interpolation (inputs, CI variables, etc.)
  /^\$\{\{.*?\}\}$/u, // ${{ ... }} interpolation
]

/**
 * Check if a value is a GitLab CI interpolation string
 */
export function isGitLabInterpolation(value?: unknown): boolean {
  if (typeof value !== "string") {
    return false
  }
  return GITLAB_INTERPOLATION_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Superrefine function that allows GitLab interpolation strings to bypass validation
 * Use with .superRefine() on any schema to make it accept interpolation strings
 *
 * @example
 * ```ts
 * const schema = z.number().superRefine(allowInterpolation)
 * // Accepts: 5, $[[ inputs.count ]]
 *
 * const stageSchema = z.enum(['test', 'deploy']).superRefine(allowInterpolation)
 * // Accepts: 'test', 'deploy', $[[ inputs.stage ]]
 * ```
 */
export function allowInterpolation(
  value: unknown,
  _ctx: z.RefinementCtx
): void {
  // If it's a GitLab interpolation, consider it valid
  if (isGitLabInterpolation(value)) {
    // oxlint-disable-next-line no-useless-return
    return
  }

  // For non-interpolation values, normal validation continues
  // (Zod will run the base schema validation)
}

/**
 * Create a schema that accepts either a specific type OR a GitLab interpolation string
 *
 * @param schema - The base schema
 * @returns Schema that accepts the base type or interpolation
 *
 * @example
 * ```ts
 * const parallelSchema = orInterpolation(z.number())
 * // Accepts: 5, $[[ inputs.parallel_count ]]
 * ```
 */
export function orInterpolation<T extends z.ZodTypeAny>(
  schema: T
): z.ZodUnion<[T, z.ZodString]> {
  const interpolationSchema = z.string().refine(isGitLabInterpolation, {
    message:
      "String must be a valid GitLab CI interpolation pattern like $[[ inputs.xxx ]]",
  })

  return z.union([schema, interpolationSchema])
}
