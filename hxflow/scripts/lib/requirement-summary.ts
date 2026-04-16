export function summarizeRequirement(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>') && !line.startsWith('#'))
    .slice(0, 8)
    .join('\n')
}
