import { readFileSync } from "node:fs"
import path from "node:path"

import { CORE_SCHEMA, loadAll } from "js-yaml"

import type { ConfigBuilder } from "../builder/config-builder"
import { ConfigBuilder as Builder } from "../builder/config-builder"
import { referenceTagResolvable } from "../importer/yaml-parser/reference"
import type { IncludeEntry } from "../schema/include"
import { resolveReferences } from "./reference-resolver"

const RESOLVABLE_SCHEMA = CORE_SCHEMA.withTags(referenceTagResolvable)

/**
 * Parse YAML with resolvable !reference tags (for resolution, not import).
 *
 * Uses a custom YAML schema that handles GitLab's !reference tags without
 * fully resolving them. Supports multi-document YAML by merging all documents
 * into a single object.
 *
 * @param yamlContent - The YAML content to parse
 * @returns Parsed YAML as a plain object with reference tags preserved as objects
 *
 * @example
 * ```ts
 * const yaml = `
 * variables:
 *   VAR: !reference [.base, vars, value]
 * `
 * const parsed = parseYamlResolvable(yaml)
 * // Returns: { variables: { VAR: { ref: ['.base', 'vars', 'value'] } } }
 * ```
 */
function parseYamlResolvable(yamlContent: string): Record<string, unknown> {
  const documents = loadAll(yamlContent, null, {
    schema: RESOLVABLE_SCHEMA,
  })

  if (documents.length === 1) {
    return documents[0] as Record<string, unknown>
  }

  const merged: Record<string, unknown> = {}
  for (const doc of documents) {
    if (doc && typeof doc === "object") {
      Object.assign(merged, doc)
    }
  }

  return merged
}

export interface ResolverOptions {
  gitlabToken?: string
  gitlabUrl?: string
  maxDepth?: number
  basePath?: string
  /** Resolve !reference tags in YAML (needed for visualization, default: false) */
  resolveReferences?: boolean
  /** Show warnings for failed includes (default: false) */
  verbose?: boolean
}

/**
 * Context for tracking remote jobs/templates during resolution
 */
interface ResolutionContext {
  remoteItems: Set<string>
}

/**
 * Resolve all includes in a configuration recursively.
 *
 * This function processes all include directives in the pipeline configuration,
 * fetching external files and merging them into the main configuration.
 * Supports:
 * - Local file includes
 * - Remote URL includes
 * - GitLab project includes
 * - GitLab CI/CD template includes
 *
 * @param config - ConfigBuilder instance to resolve includes for
 * @param options - Resolution options
 * @param options.gitlabToken - GitLab authentication token for private repositories
 * @param options.gitlabUrl - GitLab host URL (default: https://gitlab.com)
 * @param options.maxDepth - Maximum include depth to prevent infinite recursion (default: 10)
 * @param options.basePath - Base path for resolving relative local includes (default: process.cwd())
 * @param options.resolveReferences - Resolve !reference tags in YAML (default: false)
 * @returns Promise that resolves when all includes are processed
 *
 * @example
 * ```ts
 * const config = new ConfigBuilder()
 *   .include({ local: '.gitlab/ci/build.yml' })
 *   .include({ template: 'Security/SAST.gitlab-ci.yml' })
 *
 * await resolveIncludes(config, {
 *   gitlabToken: process.env.GITLAB_TOKEN
 * })
 * ```
 *
 * @throws {Error} If maximum depth is exceeded or include cannot be fetched
 */
export async function resolveIncludes(
  config: ConfigBuilder,
  options: ResolverOptions = {}
): Promise<{ failedIncludes: string[] }> {
  const maxDepth = options.maxDepth ?? 10
  const visited = new Set<string>()
  const basePath = options.basePath ?? process.cwd()
  const context: ResolutionContext = { remoteItems: new Set() }
  const failedIncludes: string[] = []

  async function resolveRecursive(
    currentConfig: ConfigBuilder,
    depth = 0
  ): Promise<void> {
    if (depth >= maxDepth) {
      throw new Error(`Maximum include depth of ${maxDepth} exceeded`)
    }

    // Get includes from the current config
    const plain = currentConfig.getPlainObject({ skipValidation: true })
    if (!plain.include) {
      return
    }

    const includes = Array.isArray(plain.include)
      ? plain.include
      : [plain.include]

    for (const include of includes) {
      // eslint-disable-next-line no-await-in-loop -- sequential resolution required: includes may depend on visited state
      const result = await resolveInclude(include, basePath, options, visited)

      // Track failed includes
      const identifier = getIncludeIdentifier(include)
      if (
        result === null &&
        identifier &&
        !visited.has(identifier) &&
        !failedIncludes.includes(identifier)
      ) {
        failedIncludes.push(identifier)
      }

      if (result) {
        // Parse the included YAML
        const includedConfig = convertYamlToConfig(result, {
          resolveReferences: options.resolveReferences,
          verbose: options.verbose,
        })

        // Recursively resolve nested includes first
        // eslint-disable-next-line no-await-in-loop -- must resolve nested includes before merging
        await resolveRecursive(includedConfig, depth + 1)

        // Then merge the fully resolved config into current config
        mergeConfigs(currentConfig, includedConfig, context)
      }
    }
  }

  await resolveRecursive(config)

  // Mark all collected remote items after resolution is complete
  markRemoteItems(config, context.remoteItems)

  return { failedIncludes }
}

/**
 * Get a unique identifier for an include entry
 */
function getIncludeIdentifier(include: IncludeEntry): string | null {
  if ("local" in include && include.local) {
    return include.local
  }
  if ("remote" in include && include.remote) {
    return include.remote
  }
  if (
    "project" in include &&
    include.project &&
    "file" in include &&
    include.file
  ) {
    const file = Array.isArray(include.file) ? include.file[0] : include.file
    return `${include.project}/${file}`
  }
  if ("template" in include && include.template) {
    return include.template
  }
  return null
}

/**
 * Resolve a single include and return its YAML content.
 *
 * Handles all GitLab CI include types:
 * - `local`: Reads files from the local filesystem
 * - `remote`: Fetches files from HTTP URLs
 * - `project`: Fetches files from GitLab projects using API
 * - `template`: Fetches official GitLab CI/CD templates
 * - `component`: Not yet supported, throws error
 *
 * Tracks visited includes to prevent circular dependencies.
 *
 * @param include - Include entry specifying the source to fetch
 * @param basePath - Base path for resolving relative local paths
 * @param options - Resolution options (tokens, URLs, etc.)
 * @param visited - Set of already visited include paths to prevent cycles
 * @returns Promise resolving to YAML content string, or null if already visited
 *
 * @example
 * ```ts
 * // Local include
 * const content = await resolveInclude(
 *   { local: '.gitlab/ci/build.yml' },
 *   '/project/root',
 *   {},
 *   new Set()
 * )
 *
 * // Remote include with authentication
 * const content = await resolveInclude(
 *   { remote: 'https://example.com/ci.yml' },
 *   '/project/root',
 *   { gitlabToken: 'glpat-xxx' },
 *   new Set()
 * )
 * ```
 *
 * @throws {Error} If file cannot be read or fetched
 */
async function resolveInclude(
  include: IncludeEntry,
  basePath: string,
  options: ResolverOptions,
  visited: Set<string>
): Promise<string | null> {
  if ("local" in include && include.local) {
    return resolveLocalInclude(include.local, basePath, visited)
  }

  if ("remote" in include && include.remote) {
    return resolveRemoteInclude(include.remote, options, visited)
  }

  if (
    "project" in include &&
    include.project &&
    "file" in include &&
    include.file
  ) {
    return resolveProjectInclude(
      include.project,
      include.file,
      include.ref,
      options,
      visited
    )
  }

  if ("template" in include && include.template) {
    return resolveTemplateInclude(include.template, visited)
  }

  if ("component" in include && include.component) {
    throw new Error("Component includes are not yet supported")
  }

  return null
}

function resolveLocalInclude(
  local: string,
  basePath: string,
  visited: Set<string>
): string | null {
  const localPath = path.isAbsolute(local)
    ? local
    : path.resolve(basePath, local)

  if (visited.has(localPath)) {
    return null
  }
  visited.add(localPath)

  try {
    return readFileSync(localPath, "utf-8")
  } catch {
    throw new Error(`Failed to read local include: ${localPath}`)
  }
}

async function resolveRemoteInclude(
  remote: string,
  options: ResolverOptions,
  visited: Set<string>
): Promise<string | null> {
  if (visited.has(remote)) {
    return null
  }
  visited.add(remote)

  try {
    const headers: Record<string, string> = {}
    if (options.gitlabToken) {
      headers.Authorization = `Bearer ${options.gitlabToken}`
    }

    const response = await fetch(remote, { headers })
    if (!response.ok) {
      // Always warn about failed remote includes
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️  Could not fetch remote include: ${remote} (${response.status} ${response.statusText})`
      )
      return null
    }
    return await response.text()
  } catch (error) {
    // Always warn about failed remote includes
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  Could not fetch remote include: ${remote} - ${error instanceof Error ? error.message : "Unknown error"}`
    )
    return null
  }
}

async function resolveProjectInclude(
  project: string,
  file: string | readonly string[],
  ref: string | undefined,
  options: ResolverOptions,
  visited: Set<string>
): Promise<string | null> {
  const filePath = Array.isArray(file) ? file[0] : file
  const projectRef = ref ?? "main"
  const projectPath = `${options.gitlabUrl ?? "https://gitlab.com"}/${project}/-/raw/${projectRef}/${filePath}`

  if (visited.has(projectPath)) {
    return null
  }
  visited.add(projectPath)

  try {
    const headers: Record<string, string> = {}
    if (options.gitlabToken) {
      headers["PRIVATE-TOKEN"] = options.gitlabToken
    }

    const response = await fetch(projectPath, { headers })
    if (!response.ok) {
      throw new Error(`Failed to fetch project include: ${projectPath}`)
    }
    return await response.text()
  } catch (error) {
    throw new Error(
      `Failed to fetch project include: ${projectPath} - ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

async function resolveTemplateInclude(
  template: string,
  visited: Set<string>
): Promise<string | null> {
  const templatePath = `https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/gitlab/ci/templates/${template}`

  if (visited.has(templatePath)) {
    return null
  }
  visited.add(templatePath)

  try {
    const response = await fetch(templatePath)
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${template}`)
    }
    return await response.text()
  } catch (error) {
    throw new Error(
      `Failed to fetch template: ${template} - ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

/**
 * Convert YAML content to a ConfigBuilder instance.
 *
 * Parses the YAML content and creates a ConfigBuilder instance with all
 * pipeline elements (stages, variables, workflow, defaults, jobs, templates).
 * Optionally resolves !reference tags before creating the builder.
 *
 * @param yamlContent - The YAML content to convert
 * @param options - Conversion options
 * @param options.resolveReferences - If true, resolves !reference tags before conversion (needed for visualization)
 * @returns ConfigBuilder instance representing the parsed configuration
 *
 * @example
 * ```ts
 * const yaml = `
 * stages:
 *   - build
 *   - test
 *
 * build-job:
 *   stage: build
 *   script: npm run build
 * `
 *
 * const config = convertYamlToConfig(yaml)
 * const plain = config.getPlainObject()
 * // Returns: { stages: ['build', 'test'], jobs: { 'build-job': {...} } }
 * ```
 */
export function convertYamlToConfig(
  yamlContent: string,
  options?: { resolveReferences?: boolean; verbose?: boolean }
): ConfigBuilder {
  const parsed = parseYamlResolvable(yamlContent)

  // Optionally resolve !reference tags before validation (needed for visualization)
  const resolved = options?.resolveReferences
    ? resolveReferences(parsed)
    : parsed

  const config = new Builder()

  // Add stages if present
  if (resolved.stages) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    config.stages(
      ...(Array.isArray(resolved.stages) ? resolved.stages : [resolved.stages])
    )
  }

  // Add variables if present
  if (resolved.variables && typeof resolved.variables === "object") {
    config.variables(
      resolved.variables as Record<string, string | number | boolean>
    )
  }

  // Add workflow if present
  if (resolved.workflow && typeof resolved.workflow === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    config.workflow(resolved.workflow as any)
  }

  // Add defaults if present
  if (resolved.default && typeof resolved.default === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    config.defaults(resolved.default as any)
  }

  // Add includes if present (needed for nested resolution)
  if (resolved.include) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    config.include(resolved.include as any)
  }

  // Add jobs and templates (mark as remote for visualization)
  // For remote includes, be lenient with validation - just store the raw definitions
  for (const [name, definition] of Object.entries(resolved)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      ![
        "stages",
        "variables",
        "workflow",
        "include",
        "default",
        "spec",
      ].includes(name)
    ) {
      try {
        if (name.startsWith(".")) {
          config.template(name, definition, { remote: true })
        } else {
          config.job(name, definition, { remote: true })
        }
      } catch (error) {
        // Skip remote jobs with validation errors - they may have complex schemas
        // The { remote: true } option already uses relaxed validation via safeParse
        // eslint-disable-next-line no-console
        console.warn(`⚠️  Skipped remote job '${name}':`, error)
      }
    }
  }

  return config
}

/**
 * Mark collected remote items with { remote: true } after resolution is complete.
 *
 * Re-adds jobs and templates to the configuration with the `remote: true` flag.
 * This flag is used by visualization tools to distinguish between local and
 * included items in the pipeline graph.
 *
 * @param config - ConfigBuilder instance to update
 * @param remoteItems - Set of job/template names that originated from includes
 *
 * @example
 * ```ts
 * const config = new ConfigBuilder()
 * const remoteItems = new Set(['build-job', '.template'])
 * markRemoteItems(config, remoteItems)
 * // Jobs 'build-job' and '.template' are now marked as remote
 * ```
 */
function markRemoteItems(
  config: ConfigBuilder,
  remoteItems: Set<string>
): void {
  const plain = config.getPlainObject({ skipValidation: true })

  // Re-add jobs and templates with remote flag for visualization
  if (plain.jobs) {
    for (const [name, job] of Object.entries(plain.jobs)) {
      if (remoteItems.has(name)) {
        if (name.startsWith(".")) {
          config.template(name, job, { remote: true })
        } else {
          config.job(name, job, { remote: true })
        }
      }
    }
  }
}

/**
 * Merge included configuration into the main configuration.
 *
 * Combines all pipeline elements from the source configuration into the target:
 * - Stages: Appended to existing stages list
 * - Variables: Merged with existing variables (source overwrites target)
 * - Workflow: Source workflow overwrites target workflow
 * - Defaults: Source defaults overwrites target defaults
 * - Jobs/Templates: Added to target, tracking remote items for later marking
 *
 * @param target - The main ConfigBuilder to merge into
 * @param source - The included ConfigBuilder to merge from
 * @param context - Resolution context for tracking remote items
 *
 * @example
 * ```ts
 * const main = new ConfigBuilder().stages('build', 'test')
 * const included = new ConfigBuilder().stages('deploy').job('deploy', {...})
 * const context = { remoteItems: new Set() }
 *
 * mergeConfigs(main, included, context)
 * // main now has stages: ['build', 'test', 'deploy'] and job 'deploy'
 * // context.remoteItems contains 'deploy'
 * ```
 */
function mergeConfigs(
  target: ConfigBuilder,
  source: ConfigBuilder,
  context: ResolutionContext
): void {
  const sourcePlain = source.getPlainObject({ skipValidation: true })

  // Merge stages
  if (sourcePlain.stages) {
    target.stages(...sourcePlain.stages)
  }

  // Merge variables
  // Remote variables should NOT override local variables
  // Get current target variables first, then merge source variables underneath
  if (sourcePlain.variables) {
    const targetPlain = target.getPlainObject({ skipValidation: true })
    const currentVars = targetPlain.variables ?? {}
    // Merge order: source variables as base, target variables override
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    target.variables({ ...sourcePlain.variables, ...currentVars } as any)
  }

  // Merge workflow
  if (sourcePlain.workflow) {
    target.workflow(sourcePlain.workflow)
  }

  // Merge defaults
  if (sourcePlain.default) {
    target.defaults(sourcePlain.default)
  }

  // Merge jobs and templates from the jobs object
  // For remote jobs, use try-catch to be lenient with validation
  if (sourcePlain.jobs) {
    for (const [name, job] of Object.entries(sourcePlain.jobs)) {
      context.remoteItems.add(name)
      try {
        if (name.startsWith(".")) {
          target.template(name, job, { remote: true })
        } else {
          target.job(name, job, { remote: true })
        }
      } catch (error) {
        // Skip jobs with validation errors - they may have complex schemas
        // we don't fully support yet (e.g., complex needs arrays)
        // eslint-disable-next-line no-console
        console.error(`❌ Skipping ${name}:`)
        // eslint-disable-next-line no-console
        console.error(error)
      }
    }
  }
}
