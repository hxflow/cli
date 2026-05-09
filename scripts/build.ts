#!/usr/bin/env bun
/**
 * Build hx binaries for all target platforms.
 * Usage: bun scripts/build.ts [--target <platform>]
 *   platforms: darwin-arm64, darwin-x64, linux-arm64, linux-x64, windows-x64
 *   default: current platform only
 */

import { mkdirSync } from "node:fs"
import { join } from "node:path"

const TARGETS = [
  { target: "bun-darwin-arm64",  out: "hx-darwin-arm64" },
  { target: "bun-darwin-x64",    out: "hx-darwin-x64" },
  { target: "bun-linux-arm64",   out: "hx-linux-arm64" },
  { target: "bun-linux-x64",     out: "hx-linux-x64" },
  { target: "bun-windows-x64",   out: "hx-windows-x64.exe" },
]

const args = process.argv.slice(2)
const targetFilter = args[args.indexOf("--target") + 1]

const distDir = join(import.meta.dir, "../dist")
mkdirSync(distDir, { recursive: true })

const toBuild = targetFilter
  ? TARGETS.filter((t) => t.out.includes(targetFilter))
  : [TARGETS.find((t) => {
      const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux"
      const arch = process.arch === "arm64" ? "arm64" : "x64"
      return t.out.includes(os) && t.out.includes(arch)
    })!]

for (const { target, out } of toBuild) {
  const outPath = join(distDir, out)
  console.log(`Building ${out}…`)
  const result = Bun.spawnSync([
    "bun", "build",
    "--compile",
    `--target=${target}`,
    "--sourcemap=none",
    "bin/hx.ts",
    `--outfile=${outPath}`,
  ], { stdio: ["ignore", "inherit", "inherit"] })

  if (result.exitCode !== 0) {
    console.error(`Failed: ${out}`)
    process.exit(1)
  }
  console.log(`  → dist/${out}`)
}

console.log("Build complete.")
