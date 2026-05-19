import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts"],
  minify: true,
  dts: true,
  deps: {
    neverBundle: ["typescript"],
  },
  format: ["esm"],
})
