import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts"],
  minify: false,
  dts: true,
  external: ["typescript"],
  format: ["esm"],
})
