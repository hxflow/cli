import { randomBytes } from "node:crypto"

export function newRunId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)               // YYYY-MM-DD
  const time = now.toISOString().slice(11, 19).replace(/:/g, "") // HHMMSS
  const hash = randomBytes(3).toString("hex")               // 6 chars
  return `r-${date}T${time}-${hash}`
}
