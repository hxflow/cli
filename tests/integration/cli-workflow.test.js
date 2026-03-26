// hx-install.cjs / hx-new-doc.js / hx-new-plan.js 等脚本已在当前版本中移除。
// 工作流命令（/hx-doc /hx-plan /hx-run 等）现在作为 Claude Code 命令在 Claude 会话中执行，
// 不再是独立的 Node.js 脚本，因此不适用传统集成测试方式。
import { describe, it } from 'vitest'

describe('workflow cli integration（已移除）', () => {
  it.todo('hx-install / hx-new-doc / hx-new-plan 等脚本已移除，工作流命令在 Claude Code 中执行')
})
