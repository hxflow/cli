import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('hx:arch command', () => {
  it('passes when imports stay within allowed layers', () => {
    const targetRoot = installProject('hx-arch-pass-', 'frontend')

    mkdirSync(resolve(targetRoot, 'src/types'), { recursive: true })
    mkdirSync(resolve(targetRoot, 'src/services'), { recursive: true })
    writeFileSync(resolve(targetRoot, 'src/types/Order.ts'), 'export const Order = { id: 1 }\n', 'utf8')
    writeFileSync(
      resolve(targetRoot, 'src/services/order-service.ts'),
      "import { Order } from '@/types/Order'\nexport function getOrder() { return Order }\n",
      'utf8'
    )

    const result = runCli(targetRoot, 'src/scripts/hx-arch-test.js', ['--profile', 'frontend'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('架构合规检查通过')
  })

  it('fails when a layer imports a forbidden downstream layer', () => {
    const targetRoot = installProject('hx-arch-fail-', 'frontend')

    mkdirSync(resolve(targetRoot, 'src/hooks'), { recursive: true })
    mkdirSync(resolve(targetRoot, 'src/pages'), { recursive: true })
    writeFileSync(resolve(targetRoot, 'src/pages/OrderPage.tsx'), 'export const OrderPage = () => null\n', 'utf8')
    writeFileSync(
      resolve(targetRoot, 'src/hooks/useOrder.ts'),
      "import { OrderPage } from '@/pages/OrderPage'\nexport function useOrder() { return OrderPage }\n",
      'utf8'
    )

    const result = runCli(targetRoot, 'src/scripts/hx-arch-test.js', ['--profile', 'frontend'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('架构合规检查失败')
    expect(result.stderr).toContain('违规目标层: Pages')
  })
})

function installProject(prefix, profile) {
  const targetRoot = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(targetRoot)

  const install = runCli(ROOT, 'src/scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', profile, '--skip-install'])
  expect(install.status).toBe(0)

  return targetRoot
}

function runCli(cwd, scriptPath, args) {
  const abs = resolve(ROOT, scriptPath)
  return spawnSync(process.execPath, [abs, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0'
    }
  })
}
