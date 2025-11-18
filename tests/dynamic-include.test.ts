import { globSync } from "tinyglobby"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Config } from "../src/config"

// Mock tinyglobby
vi.mock("tinyglobby", () => ({
  globSync: vi.fn(),
}))

describe("Config - include", () => {
  let config: Config

  beforeEach(() => {
    config = new Config()
    vi.clearAllMocks()
  })

  it("should throw error when extendConfig is not exported", async () => {
    vi.mocked(globSync).mockReturnValue(["/fake/file.ts"])

    // Mock the import to return an empty object
    vi.doMock("/fake/file.ts", () => ({ default: {} }))

    await expect(config.dynamicInclude(process.cwd(), ["*.ts"])).rejects.toThrow(
      /Please export a function extendConfig|No "extendConfig" export/,
    )

    vi.doUnmock("/fake/file.ts")
  })

  it("should throw error when extendConfig is not a function", async () => {
    vi.mocked(globSync).mockReturnValue(["/fake/file.ts"])

    // Mock dynamic import with extendConfig as non-function
    vi.doMock("/fake/file.ts", () => ({
      extendConfig: "not-a-function",
    }))

    await expect(config.dynamicInclude(process.cwd(), ["*.ts"])).rejects.toThrow(
      "The exported extendConfig is not a function!",
    )
  })

  it("should call extendConfig for each matched file", async () => {
    const mockExtendConfig = vi.fn((cfg: Config) => {
      cfg.job("included-job", { script: ["echo included"] })
    })

    vi.mocked(globSync).mockReturnValue(["/fake/file1.ts", "/fake/file2.ts"])

    // Mock dynamic imports
    vi.doMock("/fake/file1.ts", () => ({
      extendConfig: mockExtendConfig,
    }))

    vi.doMock("/fake/file2.ts", () => ({
      extendConfig: mockExtendConfig,
    }))

    await config.dynamicInclude(process.cwd(), ["**/*.config.ts"])

    // extendConfig should be called for each file
    expect(mockExtendConfig).toHaveBeenCalledTimes(2)
    expect(mockExtendConfig).toHaveBeenCalledWith(config)
  })

  it("should pass correct glob options", async () => {
    vi.mocked(globSync).mockReturnValue([])

    const cwd = "/test/directory"
    const globs = ["**/*.config.ts", "configs/*.ts"]

    await config.dynamicInclude(cwd, globs)

    expect(globSync).toHaveBeenCalledTimes(2)
    expect(globSync).toHaveBeenCalledWith(globs[0], {
      absolute: true,
      cwd,
      dot: true,
    })
    expect(globSync).toHaveBeenCalledWith(globs[1], {
      absolute: true,
      cwd,
      dot: true,
    })
  })

  it("should work with multiple globs", async () => {
    const mockExtendConfig = vi.fn()

    vi.mocked(globSync)
      .mockReturnValueOnce(["/fake/config1.ts"])
      .mockReturnValueOnce(["/fake/config2.ts"])

    vi.doMock("/fake/config1.ts", () => ({
      extendConfig: mockExtendConfig,
    }))

    vi.doMock("/fake/config2.ts", () => ({
      extendConfig: mockExtendConfig,
    }))

    await config.dynamicInclude(process.cwd(), ["configs/*.ts", "pipelines/*.ts"])

    expect(globSync).toHaveBeenCalledTimes(2)
    expect(mockExtendConfig).toHaveBeenCalledTimes(2)
  })
})
