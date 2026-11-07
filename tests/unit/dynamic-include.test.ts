// oxlint-disable vitest/max-expects
// These tests mock virtual (non-existent) module paths via vi.doMock. The paths
// must stay string literals: an `import("/fake/...")` form would make tsc try to
// resolve the module and fail (TS2307). Hence the vitest/prefer-import-in-mock rule
// is disabled for this file.
// oxlint-disable vitest/prefer-import-in-mock
import { globSync } from "tinyglobby"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ConfigBuilder } from "../../src"

type GlobSyncFn = (
  pattern: string,
  options?: Record<string, unknown>
) => string[]

const mocks = vi.hoisted(() => ({
  globSync: vi.fn<GlobSyncFn>(),
}))

vi.mock(import("tinyglobby"), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    globSync: mocks.globSync as unknown as typeof actual.globSync,
  }
})

describe("ConfigBuilder - include", () => {
  let config: ConfigBuilder

  beforeEach(() => {
    config = new ConfigBuilder()
    vi.clearAllMocks()
  })

  it("should throw error when extendConfig is not exported", async () => {
    vi.mocked(globSync).mockReturnValue(["/fake/file.ts"])

    // Mock the import to return an object without default or extendConfig
    vi.doMock("/fake/file.ts", () => ({
      default: undefined,
      extendConfig: undefined,
      someOtherExport: "value",
    }))

    await expect(
      config.dynamicInclude(process.cwd(), ["*.ts"])
    ).rejects.toThrow(
      /Please export a default function or a named "extendConfig" function!/u
    )

    vi.doUnmock("/fake/file.ts")
  })

  it("should throw error when extendConfig is not a function", async () => {
    vi.mocked(globSync).mockReturnValue(["/fake/file.ts"])

    // Mock dynamic import with extendConfig as non-function
    vi.doMock("/fake/file.ts", () => ({
      default: undefined,
      extendConfig: "not-a-function",
    }))

    await expect(
      config.dynamicInclude(process.cwd(), ["*.ts"])
    ).rejects.toThrow(/The exported function is not a function!/u)

    vi.doUnmock("/fake/file.ts")
  })

  it("should call extendConfig for each matched file", async () => {
    const mockExtendConfig = vi.fn<(cfg: ConfigBuilder) => ConfigBuilder>(
      (cfg: ConfigBuilder) => {
        cfg.job("included-job", { script: ["echo included"] })
        return cfg
      }
    )

    vi.mocked(globSync).mockReturnValue(["/fake/file1.ts", "/fake/file2.ts"])

    // Mock dynamic imports
    vi.doMock("/fake/file1.ts", () => ({
      default: undefined,
      extendConfig: mockExtendConfig,
    }))

    vi.doMock("/fake/file2.ts", () => ({
      default: undefined,
      extendConfig: mockExtendConfig,
    }))

    await config.dynamicInclude(process.cwd(), ["**/*.config.ts"])

    // extendConfig should be called for each file
    expect(mockExtendConfig).toHaveBeenCalledTimes(2)
    expect(mockExtendConfig).toHaveBeenCalledWith(config)

    vi.doUnmock("/fake/file1.ts")
    vi.doUnmock("/fake/file2.ts")
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
    const mockExtendConfig = vi.fn<() => void>()

    vi.mocked(globSync)
      .mockReturnValueOnce(["/fake/config1.ts"])
      .mockReturnValueOnce(["/fake/config2.ts"])

    vi.doMock("/fake/config1.ts", () => ({
      default: undefined,
      extendConfig: mockExtendConfig,
    }))

    vi.doMock("/fake/config2.ts", () => ({
      default: undefined,
      extendConfig: mockExtendConfig,
    }))

    await config.dynamicInclude(process.cwd(), [
      "configs/*.ts",
      "pipelines/*.ts",
    ])

    expect(globSync).toHaveBeenCalledTimes(2)
    expect(mockExtendConfig).toHaveBeenCalledTimes(2)

    vi.doUnmock("/fake/config1.ts")
    vi.doUnmock("/fake/config2.ts")
  })

  it("should support default export", async () => {
    const mockExtendConfig = vi.fn<(cfg: ConfigBuilder) => ConfigBuilder>(
      (cfg: ConfigBuilder) => {
        cfg.job("default-job", { script: ["echo default"] })
        return cfg
      }
    )

    vi.mocked(globSync).mockReturnValue(["/fake/default.ts"])

    vi.doMock("/fake/default.ts", () => ({
      default: mockExtendConfig,
    }))

    await config.dynamicInclude(process.cwd(), ["*.ts"])

    expect(mockExtendConfig).toHaveBeenCalledExactlyOnceWith(config)

    vi.doUnmock("/fake/default.ts")
  })

  it("should prefer default export over named extendConfig", async () => {
    const mockDefault = vi.fn<() => void>()
    const mockNamed = vi.fn<() => void>()

    vi.mocked(globSync).mockReturnValue(["/fake/both.ts"])

    vi.doMock("/fake/both.ts", () => ({
      default: mockDefault,
      extendConfig: mockNamed,
    }))

    await config.dynamicInclude(process.cwd(), ["*.ts"])

    expect(mockDefault).toHaveBeenCalledOnce()
    expect(mockNamed).not.toHaveBeenCalled()

    vi.doUnmock("/fake/both.ts")
  })
})
