# HXFlow Bun + TypeScript Migration Plan

> 状态：proposal
> 日期：2026-04-10
> 目标：不保留 JS/TS 兼容层，直接将 `hxflow` 重构到 `Bun + TypeScript`

---

## 1. 前提

本方案建立在以下决策之上：

- 不考虑 `JS/TS` 双栈兼容
- 不保留旧的 Node.js 脚本作为长期兼容层
- 不做“先改扩展名、逻辑不动”的表面迁移
- 技术栈目标固定为：
  - Runtime: `Bun`
  - Language: `TypeScript`
  - Test Runner: `bun test`

同时遵守架构原则：

> **确定性事实交给代码，只有高熵任务交给 AI。**

相关总设计见：

- [`code-first-workflow-architecture.md`](/Users/eleven/qiyuan-harness-workflow/docs/design/code-first-workflow-architecture.md)

---

## 2. 迁移目标

### 2.1 技术目标

- 全部核心脚本迁移到 `.ts`
- 测试统一迁移到 `bun test`
- `package.json` 运行入口统一使用 `bun`
- 建立共享类型定义，减少脚本间字符串协议

### 2.2 架构目标

- `hx-run` 从“指令生成器”升级为“代码驱动 orchestrator”
- `hx-progress` 成为稳定的 deterministic engine
- `hx-go / hx-check / hx-mr / hx-plan` 变为代码编排器
- `hx-*.md` 只保留 AI 角色，不再承担状态机职责

### 2.3 发布目标

- npm 包发布产物切换为 Bun + TS 版本
- CLI 入口仍保留 `hx`，但内部不再依赖旧的 `.js` 工作流脚本

---

## 3. 当前问题清单

在迁移前，当前仓库存在以下已知问题，必须一并处理：

### 3.1 运行时问题

- 并行执行时 `progressFile` 回写会互相覆盖
- `--plan-task` 会错误裁剪完整 task 图
- `parseFeatureHeader()` 解析范围过宽
- `hx progress start` 未校验依赖是否完成
- `hx status` 推荐的命令格式错误

### 3.2 契约与实现漂移

- `hx-run.md` 与当前测试预期不一致
- `hx-go.md` 与当前测试预期不一致
- `hx-mr.md` 与当前测试预期不一致

### 3.3 架构残留

- `hx-run` 仍是“打印说明”，不是“执行状态机”
- `hx-plan / hx-check / hx-go / hx-mr` 仍偏向“上下文加载器”
- 命令契约中仍残留 AI 手工驱动确定性命令的旧模型

---

## 4. 总体迁移顺序

本次迁移按 8 个阶段推进：

1. 收口当前回归与漂移
2. 引入 Bun + TypeScript 基础设施
3. 迁移 `lib/` 基础层
4. 迁移 deterministic 工具命令
5. 重写 `hx-run` 为 orchestrator
6. 迁移其余 orchestrator
7. 收口 CLI 入口与发布产物
8. 重写契约与测试

每个阶段完成后都应保证：

- 单测可运行
- 主链路行为可验证
- 不把“半迁移状态”带入下一阶段

---

## 5. Phase 1：收口当前回归与漂移

### 5.1 目标

在迁移技术栈前，先把当前实现收口到一个可稳定迁移的状态。

### 5.2 必做项

- 修复 `progress-ops` 并行写回覆盖问题
- 修复 `hx-run` 中 `--plan-task` 的完整任务图语义
- 修复 `feature-header` 的头部解析范围
- 修复 `hx progress start` 的依赖校验
- 修复 `hx status` 的下一步命令格式
- 同步修复：
  - `hx-run.md`
  - `hx-go.md`
  - `hx-mr.md`
  - 对应单测

### 5.3 验收

- 当前 JS 版本 `unit tests` 全绿
- review 中的 P1 / P2 问题关闭

---

## 6. Phase 2：引入 Bun + TypeScript 基础设施

### 6.1 新增文件

- `tsconfig.json`
- `bunfig.toml`

### 6.2 修改文件

- `package.json`

### 6.3 `package.json` 调整方向

建议调整：

- 测试脚本改用 `bun test`
- 运行脚本改用 `bun run`
- 清理仅服务于旧方案的依赖

建议目标：

```json
{
  "scripts": {
    "hx:test": "bun test",
    "hx:test:unit": "bun test tests/unit",
    "hx:test:integration": "bun test tests/integration"
  }
}
```

### 6.4 依赖方向

保留：

- `typescript`

移除候选：

- `vitest`

按需保留：

- `@types/node`

### 6.5 验收

- `bun install`
- `bun test` 能启动
- TypeScript 配置可解析项目源码

---

## 7. Phase 3：迁移 `lib/` 基础层

### 7.1 目标

先迁移所有确定性基础能力，并建立统一类型。

### 7.2 文件迁移清单

以下文件从 `.js` 迁为 `.ts`：

- `src/scripts/lib/config-utils.js`
- `src/scripts/lib/resolve-context.js`
- `src/scripts/lib/feature-header.js`
- `src/scripts/lib/file-paths.js`
- `src/scripts/lib/progress-schema.js`
- `src/scripts/lib/task-scheduler.js`
- `src/scripts/lib/progress-ops.js`
- `src/scripts/lib/install-utils.js`

新增：

- `src/scripts/lib/types.ts`

### 7.3 `types.ts` 初始类型建议

```ts
export type ExitStatus = 'succeeded' | 'failed' | 'aborted' | 'blocked' | 'timeout'

export type TaskStatus = 'pending' | 'in-progress' | 'done'

export interface FeatureHeader {
  feature: string
  displayName: string
  sourceId: string
  sourceFingerprint: string
}

export interface ProgressTask {
  id: string
  name: string
  status: TaskStatus
  dependsOn: string[]
  parallelizable: boolean
  output: string
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

export interface ProgressLastRun {
  taskId: string
  taskName: string
  status: 'in-progress' | 'done'
  exitStatus: ExitStatus
  exitReason: string
  ranAt: string
}

export interface ProgressData {
  feature: string
  requirementDoc: string
  planDoc: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  lastRun: ProgressLastRun | null
  tasks: ProgressTask[]
}
```

### 7.4 验收

- 所有 `lib` 级单测改为运行 TS 版本
- `feature / progress / path / scheduler` 行为保持一致

---

## 8. Phase 4：迁移 deterministic 工具命令

### 8.1 目标

先把底层工具命令迁成稳定的 TS CLI。

### 8.2 文件迁移清单

从 `.js` 迁为 `.ts`：

- `src/scripts/hx-progress.js`
- `src/scripts/hx-feature.js`
- `src/scripts/hx-archive.js`
- `src/scripts/hx-restore.js`
- `src/scripts/hx-status.js`

### 8.3 迁移要求

- CLI 参数保持兼容
- JSON 输出协议保持兼容
- 错误码语义保持兼容
- 内部改用 TS 类型

### 8.4 验收

- `hx progress next/start/done/fail/validate` 全部可用
- `hx feature parse` 可用
- `hx archive / restore / status` 可用

---

## 9. Phase 5：重写 `hx-run`

### 9.1 目标

将 `hx-run` 从“输出下一步说明”彻底重写为“代码驱动 orchestrator”。

### 9.2 文件清单

迁移并重写：

- `src/scripts/hx-run.js` -> `src/scripts/hx-run.ts`

新增：

- `src/scripts/lib/task-context.ts`
- `src/scripts/lib/ai-executor.ts`

### 9.3 必须完成的行为

- 解析 `feature` 与 `--plan-task`
- 定位并校验 `progressFile`
- 支持自动 restore
- 计算当前批次
- 对每个 task：
  - `startTask`
  - 构造最小上下文
  - 调 AI
  - `completeTask` / `failTask`
- 指定 `--plan-task` 时只执行该 task
- 未指定时循环推进到当前可推进边界
- 全部完成后进入 `hx-check`

### 9.4 `task-context.ts` 职责

从：

- `requirementDoc`
- `planDoc`
- `progressData`

提取：

- 当前 task
- 当前 task 的实施要点
- 当前 task 的验收标准
- 当前 task 的验证方式
- 必要的 requirement 摘要
- 直接依赖 task 的完成摘要

### 9.5 `ai-executor.ts` 职责

统一 AI 调用协议，避免每个命令独自拼 prompt。

推荐接口：

```ts
export async function runAiTask(input: RunAiTaskInput): Promise<RunAiTaskResult>
```

### 9.6 验收

- `hx run` 不再输出“请手工调用 hx progress ...”
- `hx run` 直接驱动 task 状态机
- AI 只收到最小 task context

---

## 10. Phase 6：迁移其余 orchestrator

### 10.1 文件清单

从 `.js` 迁为 `.ts`：

- `src/scripts/hx-plan.js` -> `src/scripts/hx-plan.ts`
- `src/scripts/hx-check.js` -> `src/scripts/hx-check.ts`
- `src/scripts/hx-go.js` -> `src/scripts/hx-go.ts`
- `src/scripts/hx-mr.js` -> `src/scripts/hx-mr.ts`

### 10.2 `hx-plan.ts`

代码负责：

- requirement 头部解析
- 模板定位
- `progressFile` 骨架初始化
- schema 校验

AI 负责：

- task 拆分
- plan 正文生成

### 10.3 `hx-check.ts`

代码负责：

- gates
- diff
- checklist
- deterministic qa

AI 负责：

- review
- clean

### 10.4 `hx-go.ts`

代码负责：

- pipeline 状态机
- 自动恢复起点
- 子命令调度

### 10.5 `hx-mr.ts`

代码负责：

- 读取 requirement / progress / git facts
- 归档条件校验

AI 负责：

- MR 标题与描述生成

---

## 11. Phase 7：统一 CLI 入口与发布产物

### 11.1 目标

入口文件保留 `hx`，但内部全部切到 TS + Bun。

### 11.2 修改文件

- `bin/hx.js`
- `package.json`

### 11.3 入口调整方向

`bin/hx.js` 只负责：

- 解析一级命令
- 路由到 `.ts` 命令实现

不再承载：

- 旧 JS 脚本兼容逻辑
- 旧的分层过渡逻辑

### 11.4 发布产物要点

- 确认 npm 发包包含：
  - `bin/hx.js`
  - `src/scripts/**/*.ts`
  - `src/contracts/**/*`
  - `src/commands/**/*`
  - `src/templates/**/*`
- 删除不再需要的 `.js` 产物清单

---

## 12. Phase 8：重写命令契约与测试

### 12.1 命令契约

重点修改：

- `src/commands/hx-run.md`
- `src/commands/hx-plan.md`
- `src/commands/hx-go.md`
- `src/commands/hx-check.md`
- `src/commands/hx-mr.md`
- `src/contracts/runtime-contract.md`
- `src/contracts/progress-contract.md`

重写原则：

- 命令契约只描述 AI 角色与边界
- 状态机细节全部下沉到代码
- 不再让 AI 手工驱动 `hx progress`

### 12.2 测试迁移

重点修改：

- `tests/unit/command-contracts.test.js`
- `tests/unit/feature-contract.test.js`
- `tests/unit/progress-ops.test.js`
- `tests/unit/task-scheduler.test.js`
- `tests/unit/feature-header.test.js`
- `tests/unit/file-paths.test.js`

方向：

- 迁到 TypeScript
- 统一在 Bun 下运行
- 让测试对准新的 code-first 行为

### 12.3 应补测试

- `hx-run` orchestrator 状态机测试
- `--plan-task` 行为测试
- parallel batch 安全写回测试
- `task-context` 提取测试
- `ai-executor` 结果映射测试
- `hx-check` 收尾触发测试

---

## 13. 文件级迁移清单

### 13.1 新增

- `tsconfig.json`
- `bunfig.toml`
- `src/scripts/lib/types.ts`
- `src/scripts/lib/task-context.ts`
- `src/scripts/lib/ai-executor.ts`
- `src/scripts/lib/pipeline-state.ts`

### 13.2 迁移为 `.ts`

- `src/scripts/hx-plan.ts`
- `src/scripts/hx-run.ts`
- `src/scripts/hx-check.ts`
- `src/scripts/hx-go.ts`
- `src/scripts/hx-mr.ts`
- `src/scripts/hx-progress.ts`
- `src/scripts/hx-feature.ts`
- `src/scripts/hx-archive.ts`
- `src/scripts/hx-restore.ts`
- `src/scripts/hx-status.ts`
- `src/scripts/lib/config-utils.ts`
- `src/scripts/lib/resolve-context.ts`
- `src/scripts/lib/feature-header.ts`
- `src/scripts/lib/file-paths.ts`
- `src/scripts/lib/install-utils.ts`
- `src/scripts/lib/progress-schema.ts`
- `src/scripts/lib/progress-ops.ts`
- `src/scripts/lib/task-scheduler.ts`

### 13.3 删除候选

当迁移完成后，删除：

- 对应的 `.js` 文件
- `vitest` 依赖
- 仅服务旧运行时的过渡代码

---

## 14. 推荐提交顺序

建议按阶段提交，而不是一个超大提交。

推荐提交粒度：

1. `refactor: stabilize deterministic workflow foundation`
2. `refactor: add bun and typescript runtime foundation`
3. `refactor: migrate workflow lib layer to typescript`
4. `refactor: migrate deterministic workflow commands to typescript`
5. `refactor: convert hx-run into code-first orchestrator`
6. `refactor: migrate workflow orchestrators to typescript`
7. `refactor: rewrite contracts for code-first workflow`
8. `chore: unify tests and package scripts on bun`

---

## 15. 最终验收标准

当以下条件同时满足时，本次迁移视为完成：

1. 仓库核心脚本已无 `.js` 残留
2. 主链路已运行在 `Bun + TypeScript`
3. `hx-run` 已变为代码驱动 orchestrator
4. `hx progress` 已成为稳定 deterministic engine
5. AI 只消费最小 task context
6. 契约不再承担状态机职责
7. `bun test` 全绿

---

## 16. 一句话路线图

先修当前回归，再切运行底座，先迁 deterministic engine，再重写 orchestrator，最后收口契约与测试。
