#!/usr/bin/env node

/**
 * hx-feature.js — 需求文档工具命令集
 *
 * 用法：
 *   hx feature parse <requirementDoc>
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { resolve } from 'path'
import { parseFeatureHeaderFile } from './lib/feature-header.ts'
import { getSafeCwd } from './lib/resolve-context.ts'

const args = process.argv.slice(2)
const [sub, ...rest] = args

function out(data) {
  console.log(JSON.stringify(data, null, 2))
}

function err(message) {
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
}

switch (sub) {
  case 'parse': {
    const [rawPath] = rest
    if (!rawPath) err('用法：hx feature parse <requirementDoc>')

    try {
      const filePath = resolve(getSafeCwd(), rawPath)
      const header = parseFeatureHeaderFile(filePath)
      out({ ok: true, ...header })
    } catch (error) {
      err(error.message)
    }
    break
  }

  default:
    err(`未知子命令 "${sub}"，可用：parse`)
}
