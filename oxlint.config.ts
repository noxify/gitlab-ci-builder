import { defineConfig } from "oxlint"
import core from "ultracite/oxlint/core"
import vitest from "ultracite/oxlint/vitest"

export default defineConfig({
  extends: [core, vitest],
  ignorePatterns: [".tegami/publish-lock.yaml"],
  overrides: [
    {
      files: ["tests/**/*.ts", "**/*.test.ts"],
      rules: {
        "vitest/max-expects": "off",
      },
    },
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        "no-use-before-define": [
          "error",
          {
            allowNamedExports: true,
            functions: false,
            ignoreTypeReferences: true,
          },
        ],
      },
    },
    {
      files: [
        "src/index.ts",
        "src/builder/index.ts",
        "src/resolver/index.ts",
        "src/resolution/index.ts",
        "src/schema/index.ts",
      ],
      rules: {
        "oxc/no-barrel-file": "off",
      },
    },
  ],
  rules: {
    "vitest/max-expects": "off",
    "func-style": "off",
    "no-console": "error",
    "no-inline-comments": "off",
    "no-nested-ternary": "off",
    // Keep disabled globally; re-enable selectively via overrides for runtime-heavy paths.
    "no-use-before-define": "off",
    // "no-restricted-imports": [
    //   "error",
    //   {
    //     importNames: ["env"],
    //     message:
    //       "Use `import { env } from '~/env'` instead to ensure validated types.",
    //     name: "process",
    //   },
    // ],
    // "no-restricted-properties": [
    //   "error",
    //   {
    //     message:
    //       "Use `import { env } from '~/env'` instead to ensure validated types.",
    //     object: "process",
    //     property: "env",
    //   },
    // ],
    "require-await": "off",
    "sort-keys": "off",
    "unicorn/no-nested-ternary": "off",
  },
})
