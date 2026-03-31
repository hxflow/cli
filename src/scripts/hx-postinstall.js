#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const setupScript = resolve(__dirname, 'hx-setup.js')
const packageRoot = resolve(__dirname, '..', '..')

if (process.env.HX_DISABLE_AUTO_SETUP === '1') {
  process.exit(0)
}

// Avoid mutating the developer's home directory when running install inside this repo.
if (resolve(process.env.INIT_CWD || '') === packageRoot) {
  process.exit(0)
}

try {
  execFileSync(process.execPath, [setupScript], {
    stdio: 'inherit',
    env: process.env,
  })
} catch (error) {
  console.warn(`\n[hx] auto setup skipped: ${error.message}\n`)
}
