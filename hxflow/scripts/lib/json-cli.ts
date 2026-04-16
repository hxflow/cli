export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function exitWithJsonError(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}
