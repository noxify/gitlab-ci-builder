import { fs } from "memfs"
import { vi } from "vitest"

// Setup memfs mocks before any tests run
vi.mock("fs/promises", () => ({ default: fs.promises }))
vi.mock("fs", () => fs)
