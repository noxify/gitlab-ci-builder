/* eslint-disable @typescript-eslint/no-explicit-any */
import { exec } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"
import type { ZodType } from "zod"
import type { JSONSchema } from "zod/v4/core"
import { compile } from "json-schema-to-typescript"
import { toJSONSchema } from "zod"

import {
  GlobalVariableSchema,
  ImageSchema,
  JobVariableSchema,
  ScriptSchema,
  ServiceSchema,
  TagsSchema,
} from "../src/schema/base"
import { DefaultsSchema } from "../src/schema/defaults"
import { IncludeInputSchema } from "../src/schema/include"
import { ArtifactsSchema, BaseJobSchema, CacheSchema, RuleSchema } from "../src/schema/job"
import { SpecSchema } from "../src/schema/spec"
import { WorkflowRuleSchema, WorkflowSchema } from "../src/schema/workflow"

const execAsync = promisify(exec)

async function generateTypes(): Promise<void> {
  const schemas: { name: string; schema: ZodType<any, any, any> }[] = [
    { name: "Rule", schema: RuleSchema },
    { name: "Artifacts", schema: ArtifactsSchema },
    { name: "Cache", schema: CacheSchema },
    { name: "BaseJob", schema: BaseJobSchema },
    { name: "IncludeInput", schema: IncludeInputSchema },
    { name: "WorkflowRule", schema: WorkflowRuleSchema },
    { name: "Workflow", schema: WorkflowSchema },
    { name: "Defaults", schema: DefaultsSchema },
    { name: "Spec", schema: SpecSchema },
    { name: "GlobalVariable", schema: GlobalVariableSchema },
    { name: "JobVariable", schema: JobVariableSchema },
    { name: "Script", schema: ScriptSchema },
    { name: "Image", schema: ImageSchema },
    { name: "Service", schema: ServiceSchema },
    { name: "Tags", schema: TagsSchema },
  ]

  const generatedTypes: string[] = [
    "/* eslint-disable @typescript-eslint/no-redundant-type-constituents */",
    "// Generated types from Zod schemas",
    "// Do not edit manually - run 'pnpm generate:types' to regenerate",
    "",
  ]

  for (const { name, schema } of schemas) {
    try {
      // Convert Zod schema to JSON Schema with inline expansion
      const jsonSchema = toJSONSchema(schema, {
        reused: "inline",
        unrepresentable: "any",
      })

      // Convert JSON Schema to TypeScript
      let tsType = await compile(jsonSchema as typeof JSONSchema, name, {
        bannerComment: "",
        style: {
          printWidth: 100,
          semi: false,
          singleQuote: false,
          tabWidth: 2,
        },
      })

      // Post-process: Only replace empty object types
      // Let ESLint fix the index signatures automatically
      tsType = tsType.replace(/\| \{\}/g, "| Record<string, unknown>")
      tsType = tsType.replace(/\{\}\[\]/g, "Record<string, unknown>[]")

      generatedTypes.push(tsType)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`❌ Failed to generate type for ${name}:`, error)
      throw error
    }
  }

  // Write to file
  const outputPath = resolve(process.cwd(), "src/generated/types.ts")
  await writeFile(outputPath, generatedTypes.join("\n"), "utf-8")

  // Run ESLint fix on the generated file
  try {
    await execAsync(`pnpm eslint --fix ${outputPath}`)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ESLint might exit with code 1 if there are unfixable errors, but that's okay
    // The file will still be formatted and most issues will be fixed
  }
}

generateTypes().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("❌ Failed to generate types:", error)
  process.exit(1)
})
