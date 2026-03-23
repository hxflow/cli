# Phase 05 · 代码审查

无需参数，自动审查当前未提交的 diff 或最近一次 commit 的变更。

## 执行步骤

### 1. 获取变更范围
- 优先使用 `git diff`（未暂存 + 已暂存的变更）
- 如果无变更，使用 `git diff HEAD~1` 审查最近一次 commit
- 如果提供了 PR 编号作为参数，使用 `gh pr diff` 获取

### 2. 加载审查依据
读取以下文件：
1. `harness-scaffold/docs/golden-principles.md`（黄金原则）
2. `harness-scaffold/docs/map.md`（架构层级）

### 3. 自动扫描（AI 代码常见失效模式）

**架构合规**：
- Service 层是否 import 了 Runtime/UI 模块
- Repo 层是否包含业务逻辑（if/else 判断、数据转换）
- 是否有跨层导入

**规范检查**：
- `console.log` 存在于 `src/`（GP-001）
- `: any` 类型泄漏（GP-009）
- 裸 `throw new Error('...')`（GP-003）
- Service 层过度 try-catch（GP-004）
- 组件内直接 fetch/axios（GP-005）
- 单文件超 200 行（GP-006）
- 魔法数字（GP-011）

**AI Slop 检查**：
- 过度抽象：只用一次的逻辑被提取为独立函数/Hook
- 冗余注释：对自解释代码添加无意义注释
- 不必要的类型断言 `as XXX`

**文档同步**：
- 新增/修改的接口是否已反映在 `docs/design/` 对应文档中

### 4. 输出报告

按优先级分组输出：

```
── 代码审查报告 ─────────────────────────

🔴 必须修复（阻断合并）
  1. src/service/authService.ts:47 — 违反 GP-003: 使用了裸 throw new Error，应改为 AppError
  2. src/service/authService.ts:12 — 违反架构规则: Service 层导入了 src/runtime/

🟡 建议修复
  1. src/hooks/useLogin.ts:23 — GP-009: 参数类型为 any，建议改为具体类型
  2. src/components/auth/LoginForm.tsx — 过度抽象: formatEmail 函数只使用一次，建议内联

⚪ 观察项
  1. docs/design/user-login.md — 文档中 AC-003 的锁定时长与代码实现不一致（文档: 15min，代码: 10min）

摘要: 2 个必须修复，2 个建议修复，1 个观察项
修复后运行: /hx-gate
```
