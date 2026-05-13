import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "bun:test"

const ROOT = process.cwd()

describe("hx command surface", () => {
  it("keeps workflow steps out of the public hx CLI", () => {
    const source = readFileSync(resolve(ROOT, "bin", "hx.ts"), "utf8")

    expect(source).toContain("agent: agentCmd")
    expect(source).toContain("run: runCmd")
    expect(source).toContain("login")

    for (const command of ["doc", "plan", "review", "mr", "go", "init", "status", "reset", "console"]) {
      expect(source).not.toContain(`${command}:`)
      expect(source).not.toContain(`../src/commands/${command}`)
    }
  })

  it("does not depend on the console package or source tree", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>
    }
    const source = readFileSync(resolve(ROOT, "bin", "hx.ts"), "utf8")

    expect(pkg.dependencies?.["@hxflow/console"]).toBeUndefined()
    expect(source).not.toContain("@hxflow/console")
    expect(source).not.toContain("hx-console")
    expect(source).not.toContain("consoleCmd")
  })
})
