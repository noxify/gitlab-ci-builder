import { describe, expect, it } from "vitest"

import { fromYaml } from "../../src/import"

describe("Script formatting", () => {
  it("should format simple single-line script as string", () => {
    const yaml = `
test:
  script:
    - echo "hello world"
`
    const result = fromYaml(yaml)
    expect(result).toContain('script: ["echo \\"hello world\\""]')
  })

  it("should format simple multi-line commands as array", () => {
    const yaml = `
test:
  script:
    - |
      echo "step1"
      echo "step2"
      echo "step3"
`
    const result = fromYaml(yaml)
    expect(result).toContain('script: ["echo \\"step1\\"", "echo \\"step2\\"", "echo \\"step3\\""]')
    expect(result).not.toContain("script: [[")
  })

  it("should preserve line continuation with backslash as template literal", () => {
    const yaml = `
test:
  script:
    - |
      apk update && \\
          apk add --no-cache libc6-compat aws-cli jq && \\
          rm -rf /var/cache/apk/*
`
    const result = fromYaml(yaml)
    expect(result).toContain("script: [`apk update")
    expect(result).toContain("apk add --no-cache")
    expect(result).toContain("rm -rf /var/cache/apk/*")
    expect(result).toContain("`]")
  })

  it("should preserve heredoc as template literal", () => {
    const yaml = `
test:
  script:
    - |
      cat <<EOF
      line1
      line2
      EOF
`
    const result = fromYaml(yaml)
    expect(result).toContain("script: [`cat <<EOF")
    expect(result).toContain("line1")
    expect(result).toContain("line2")
    expect(result).toContain("EOF")
    expect(result).toContain("`]")
  })

  it("should preserve pipe operators as template literal", () => {
    const yaml = `
test:
  script:
    - |
      cat file.txt | grep "pattern" | sort
`
    const result = fromYaml(yaml)
    expect(result).toContain('script: [`cat file.txt | grep "pattern" | sort')
    expect(result).toContain("`]")
  })

  it("should preserve output redirection as template literal", () => {
    const yaml = `
test:
  script:
    - |
      echo "output" > file.txt
      echo "append" >> file.txt
      command 2> error.log
`
    const result = fromYaml(yaml)
    expect(result).toContain("script: [`echo")
    expect(result).toContain("> file.txt")
    expect(result).toContain(">> file.txt")
    expect(result).toContain("2> error.log")
    expect(result).toContain("`]")
  })

  it("should handle mixed script array with different formats", () => {
    const yaml = `
test:
  script:
    - echo "simple"
    - |
      echo "multi1"
      echo "multi2"
    - |
      complex && \\
          continuation
`
    const result = fromYaml(yaml)
    expect(result).toContain('script: ["echo \\"simple\\"",')
    expect(result).toContain('"echo \\"multi1\\"", "echo \\"multi2\\""')
    expect(result).toContain("`complex")
    expect(result).not.toContain("script: [[")
  })

  it("should handle before_script with shell operators", () => {
    const yaml = `
test:
  before_script:
    - |
      mkdir ~/.npm-global
      export PATH=$PATH:~/.npm-global/bin
      npm i -g pnpm@10.22.0
`
    const result = fromYaml(yaml)
    expect(result).toContain("before_script:")
    expect(result).toContain(
      '"mkdir ~/.npm-global", "export PATH=$PATH:~/.npm-global/bin", "npm i -g pnpm@10.22.0"',
    )
  })

  it("should handle after_script with continuations", () => {
    const yaml = `
test:
  after_script:
    - |
      cleanup && \\
          remove_temp
`
    const result = fromYaml(yaml)
    expect(result).toContain("after_script: [`cleanup")
    expect(result).toContain("remove_temp")
    expect(result).toContain("`]")
  })

  it("should handle logical operators correctly", () => {
    const yaml = `
test:
  script:
    - |
      command1 || echo "fallback"
      command2 && echo "success"
`
    const result = fromYaml(yaml)
    // || and && are logical operators, not pipes - should be split into array
    expect(result).toContain(
      '["command1 || echo \\"fallback\\"", "command2 && echo \\"success\\""]',
    )
  })

  it("should escape backticks in template literals", () => {
    const yaml = `
test:
  script:
    - |
      echo \`date\` > file.txt
`
    const result = fromYaml(yaml)
    expect(result).toContain("\\`date\\`")
  })

  it("should escape template expressions in template literals", () => {
    const yaml = `
test:
  script:
    - |
      echo "\${VAR}" > file.txt
`
    const result = fromYaml(yaml)
    expect(result).toContain("\\${VAR}")
  })

  it("should handle empty lines in multiline scripts", () => {
    const yaml = `
test:
  script:
    - |
      echo "line1"

      echo "line2"
`
    const result = fromYaml(yaml)
    // Empty lines should be filtered out when splitting
    expect(result).toContain('["echo \\"line1\\"", "echo \\"line2\\""]')
  })

  it("should handle input redirection", () => {
    const yaml = `
test:
  script:
    - |
      command < input.txt
`
    const result = fromYaml(yaml)
    expect(result).toContain("`command < input.txt")
    expect(result).toContain("`]")
  })
})
