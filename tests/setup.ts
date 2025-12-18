import { fs } from "memfs"
import { afterAll, afterEach, beforeAll, vi } from "vitest"

import { server } from "./mocks/server"

// Setup memfs mocks before any tests run
vi.mock("node:fs/promises", () => ({
  default: fs.promises,
  writeFile: fs.promises.writeFile,
  mkdir: fs.promises.mkdir,
  readFile: fs.promises.readFile,
}))
vi.mock("node:fs", () => fs)
vi.mock("fs/promises", () => ({
  default: fs.promises,
  writeFile: fs.promises.writeFile,
  mkdir: fs.promises.mkdir,
  readFile: fs.promises.readFile,
}))
vi.mock("fs", () => fs)

// Setup MSW server for mocking HTTP requests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
