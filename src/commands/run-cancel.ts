import { defineCommand } from "citty"
import chalk from "chalk"
import { readHandle, readManifest } from "../runs/store.ts"
import { selectBackend } from "../backend/index.ts"
import type { RunHandle } from "../backend/types.ts"

export default defineCommand({
  meta: { description: "Cancel a running run" },
  args: {
    runId: { type: "positional", description: "Run ID" },
  },
  async run({ args }) {
    const runId = args.runId as string
    const manifest = readManifest(runId)
    if (!manifest) {
      console.error(`Run not found: ${runId}`)
      process.exit(1)
    }
    const raw = readHandle(runId) as any
    if (!raw) {
      console.error(`No handle found for run ${runId} — may have already finished`)
      process.exit(1)
    }
    const handle: RunHandle = {
      runId,
      backend: manifest.backend as "docker" | "podman" | "k8s",
      native: raw.containerId ?? raw.native,
    }
    const backend = selectBackend(handle.backend)
    await backend.cancel(handle)
    console.log(chalk.yellow(`Run ${runId} cancelled (SIGTERM sent, container has 15s to flush)`))
  },
})
