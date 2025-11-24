import { readFileSync } from "node:fs"
import { isAbsolute, resolve } from "node:path"

import type { ConfigBuilder } from "../builder"
import type { IncludeEntry } from "../schema"

export interface ResolverOptions {
  gitlabToken?: string
  gitlabUrl?: string
  maxDepth?: number
  basePath?: string
}

/**
 * Context for tracking remote jobs/templates during resolution
 */
interface ResolutionContext {
  remoteItems: Set<string>
}

/**
 * Resolve all includes in a configuration recursively
 */
export async function resolveIncludes(
  config: ConfigBuilder,
  options: ResolverOptions = {},
): Promise<void> {
  const maxDepth = options.maxDepth ?? 10
  const visited = new Set<string>()
  const basePath = options.basePath ?? process.cwd()
  const context: ResolutionContext = { remoteItems: new Set() }

  async function resolveRecursive(currentConfig: ConfigBuilder, depth = 0): Promise<void> {
    if (depth >= maxDepth) {
      throw new Error(`Maximum include depth of ${maxDepth} exceeded`)
    }

    // Get includes from the current config
    const plain = currentConfig.getPlainObject({ skipValidation: true })
    if (!plain.include) return

    const includes = Array.isArray(plain.include) ? plain.include : [plain.include]

    for (const include of includes) {
      const content = await resolveInclude(include, basePath, options, visited)
      if (!content) continue

      // Parse the included YAML
      const includedConfig = await convertYamlToConfig(content)

      // Recursively resolve nested includes first
      await resolveRecursive(includedConfig, depth + 1)

      // Then merge the fully resolved config into current config
      mergeConfigs(currentConfig, includedConfig, context)
    }
  }

  await resolveRecursive(config)

  // Mark all collected remote items after resolution is complete
  markRemoteItems(config, context.remoteItems)
}

/**
 * Resolve a single include and return its YAML content
 */
async function resolveInclude(
  include: IncludeEntry,
  basePath: string,
  options: ResolverOptions,
  visited: Set<string>,
): Promise<string | null> {
  // Local file
  if ("local" in include && include.local) {
    const localPath = isAbsolute(include.local) ? include.local : resolve(basePath, include.local)

    if (visited.has(localPath)) {
      return null // Avoid circular includes
    }
    visited.add(localPath)

    try {
      return readFileSync(localPath, "utf-8")
    } catch {
      throw new Error(`Failed to read local include: ${localPath}`)
    }
  }

  // Remote file
  if ("remote" in include && include.remote) {
    if (visited.has(include.remote)) {
      return null
    }
    visited.add(include.remote)

    try {
      const headers: Record<string, string> = {}
      if (options.gitlabToken) {
        headers.Authorization = `Bearer ${options.gitlabToken}`
      }

      const response = await fetch(include.remote, { headers })
      if (!response.ok) {
        throw new Error(`Failed to fetch remote include: ${include.remote}`)
      }
      return await response.text()
    } catch (error) {
      throw new Error(
        `Failed to fetch remote include: ${include.remote} - ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Project include
  if ("project" in include && include.project && "file" in include && include.file) {
    const file = Array.isArray(include.file) ? include.file[0] : include.file
    const ref = include.ref ?? "main"
    const projectPath = `${options.gitlabUrl ?? "https://gitlab.com"}/${include.project}/-/raw/${ref}/${file}`

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
      )
    }
  }

  // Template include (GitLab CI/CD templates)
  if ("template" in include && include.template) {
    const templatePath = `https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/gitlab/ci/templates/${include.template}`

    if (visited.has(templatePath)) {
      return null
    }
    visited.add(templatePath)

    try {
      const response = await fetch(templatePath)
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${include.template}`)
      }
      return await response.text()
    } catch (error) {
      throw new Error(
        `Failed to fetch template: ${include.template} - ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Component include
  if ("component" in include && include.component) {
    throw new Error("Component includes are not yet supported")
  }

  return null
}

/**
 * Convert YAML content to a ConfigBuilder instance
 */
async function convertYamlToConfig(yamlContent: string): Promise<ConfigBuilder> {
  const { load: parseYaml } = await import("js-yaml")
  const { ConfigBuilder } = await import("../builder")

  const parsed = parseYaml(yamlContent) as Record<string, unknown>
  const config = new ConfigBuilder()

  // Add stages if present
  if (parsed.stages) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    config.stages(...(Array.isArray(parsed.stages) ? parsed.stages : [parsed.stages]))
  }

  // Add variables if present
  if (parsed.variables && typeof parsed.variables === "object") {
    config.variables(parsed.variables as Record<string, string | number | boolean>)
  }

  // Add workflow if present
  if (parsed.workflow && typeof parsed.workflow === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    config.workflow(parsed.workflow as any)
  }

  // Add defaults if present
  if (parsed.default && typeof parsed.default === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    config.defaults(parsed.default as any)
  }

  // Add includes if present (needed for nested resolution)
  if (parsed.include) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    config.include(parsed.include as any)
  }

  // Add jobs and templates (mark as remote for visualization)
  for (const [name, definition] of Object.entries(parsed)) {
    if (
      typeof definition === "object" &&
      definition !== null &&
      !["stages", "variables", "workflow", "include", "default", "spec"].includes(name)
    ) {
      if (name.startsWith(".")) {
        config.template(name, definition, { remote: true })
      } else {
        config.job(name, definition, { remote: true })
      }
    }
  }

  return config
}

/**
 * Mark collected remote items with { remote: true } after resolution is complete
 */
function markRemoteItems(config: ConfigBuilder, remoteItems: Set<string>): void {
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
 * Merge included configuration into the main configuration
 */
function mergeConfigs(
  target: ConfigBuilder,
  source: ConfigBuilder,
  context: ResolutionContext,
): void {
  const sourcePlain = source.getPlainObject({ skipValidation: true })

  // Merge stages
  if (sourcePlain.stages) {
    target.stages(...sourcePlain.stages)
  }

  // Merge variables
  if (sourcePlain.variables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    target.variables(sourcePlain.variables as any)
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
  // Track remote items in context without marking during merge to allow proper resolution
  if (sourcePlain.jobs) {
    for (const [name, job] of Object.entries(sourcePlain.jobs)) {
      context.remoteItems.add(name)
      if (name.startsWith(".")) {
        target.template(name, job)
      } else {
        target.job(name, job)
      }
    }
  }
}
