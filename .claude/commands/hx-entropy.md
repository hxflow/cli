# Phase 07 · 熵扫描报告

无需参数，扫描整个 harness-scaffold 仓库。

## 执行步骤

### 1. AI Slop 模式扫描
扫描 `harness-scaffold/src/**/*.ts` 和 `*.tsx`，检测以下模式：

| 模式 | 规则 | 严重度 |
|------|------|--------|
| `console.log` | GP-001 | 🔴 |
| `catch (e) { // ` 空 catch | GP-004 | 🔴 |
| `: any` | GP-009 | 🟡 |
| `TODO` / `FIXME` / `HACK` | 质量标记 | 🟡 |
| `as XXX` 类型断言 | GP-010 | 🟡 |
| 超过 200 行的文件 | GP-006 | 🟡 |

### 2. 文档新鲜度检查
- 扫描 `harness-scaffold/docs/design/*.md`
- 对每个文档中引用的 `src/` 文件，比较最后修改时间
- 如果源码比文档更新，标记为可能过期

### 3. 架构合规检查
- 运行 `harness-scaffold/scripts/hx-arch-test.js` 的逻辑
- 检查 src/repo/ 是否导入了 src/service/
- 检查 src/service/ 是否导入了 src/runtime/
- 检查 src/types/ 是否导入了其他层

### 4. 进度文件审计
- 扫描所有 `docs/plans/*-progress.json`
- 列出超过 2 周未更新且仍有 pending 状态的 TASK
- 列出已完成但未从 AGENTS.md 移除的特性

### 5. 黄金原则覆盖度
- 读取 `docs/golden-principles.md` 中的所有 GP-XXX 编号
- 检查是否有 GP 规则对应的 lint 配置（在 eslint.config.js 中）
- 标记没有自动化保障的原则

## 输出格式

```
── 熵扫描报告 ──────────────────────────
📅 扫描时间: 2024-03-15
📁 扫描范围: harness-scaffold/src/

■ AI Slop 检测
  🔴 console.log ×2 — src/service/authService.ts, src/hooks/useLogin.ts
  🟡 : any ×1 — src/repo/userRepo.ts:34
  🟡 TODO ×3 — src/service/authService.ts:12, src/runtime/authController.ts:8, :45

■ 文档新鲜度
  ⚠ docs/design/user-login.md 可能过期（引用的 src/service/authService.ts 更新于 2 天后）
  ✓ 其余 X 个文档与代码同步

■ 架构合规
  ✓ 无跨层违规

■ 进度审计
  ⚠ user-login: TASK-BE-05 已 pending 超过 14 天
  ✓ 无需清理的已完成特性

■ 规则覆盖
  ⚠ GP-011（禁止魔法数字）尚无对应 lint 规则

── 建议操作 ─────────────────────────
1. 修复 2 个 console.log（GP-001 违规）
2. 更新 docs/design/user-login.md
3. 为 GP-011 新增 eslint 规则
4. 推进 TASK-BE-05 或标记为放弃
```
