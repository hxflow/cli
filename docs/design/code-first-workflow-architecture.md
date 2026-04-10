# HXFlow Code-First Workflow Architecture

> 状态：proposal
> 日期：2026-04-10
> 目标：从 AI-first 工作流重构为 code-first 工作流

---

## 0. 技术栈决策

本次重构不仅调整工作流理念，也统一实现技术栈：

- Runtime: `Bun`
- Language: `TypeScript`
- Module System: `ESM`
- Test Runner: 优先统一到 `bun test`

### 0.1 为什么统一到 Bun + TypeScript

- `hxflow` 的核心正在从 prompt 驱动转向本地代码驱动，运行时能力会持续增加
- `Bun` 适合作为 CLI、脚本、测试和包管理的一体化运行时
- `TypeScript` 适合承载状态机、schema、上下文对象与 AI 调用接口的强类型边界
- 统一后可减少：
  - Node / npm / Vitest / 零散脚本的混搭复杂度
  - 动态对象与字符串协议带来的隐性回归
  - orchestrator 和 engine 层之间的类型漂移

### 0.2 重构后的统一约束

- 新增 orchestrator / engine / adapter 代码优先使用 `.ts`
- 新增共享数据结构必须先定义类型，再落实现
- 能用类型表达的状态机约束，不再仅靠文档约束
- 新增脚本优先以 `bun run` / `bun test` 作为执行与验证入口

### 0.3 迁移策略

本次技术栈统一采用渐进迁移，不要求一次性全量改完：

1. 新代码优先写成 TypeScript
2. 旧的 `.js` 脚本按命令链路逐步迁移到 `.ts`
3. 先迁移核心主链路：
   - `hx-run`
   - `hx-progress`
   - `hx-check`
   - `hx-go`
4. 稳定后再统一测试与构建入口

换句话说：

- 架构改造可以分阶段推进
- 但技术方向不再摇摆，统一以 `Bun + TypeScript` 为目标栈

---

## 1. 背景

当前 `hxflow` 已经开始把部分确定性逻辑迁到 Node.js 脚本中，例如：

- `feature` 头部解析
- `progressFile` 的调度与状态写回
- 归档 / 还原路径计算
- `hx run` / `hx plan` / `hx go` / `hx check` / `hx mr` 的 CLI 入口

但主链路仍然保留了明显的 AI-first 痕迹：

- 代码脚本主要负责“打印下一步要做什么”
- AI 仍然需要理解大量流程规则后再决定如何执行
- 命令契约仍在承担部分状态机职责
- `hx run` 仍是“AI 指令生成器”，不是“流程编排器”

结果是：

- 确定性事实重复进入上下文
- AI 需要理解过多框架规则
- 主链路稳定性依赖 prompt，而不是代码
- 上下文成本偏高，恢复与校验链路不够稳

因此，本次重构不再延续“AI 先读规则，再驱动流程”的模型，而改为：

> **确定性的事实用代码固化，只有真正适合 AI 做的事情才交给 AI。**

同时，底层实现栈统一收敛到：

> **Bun 作为运行时，TypeScript 作为唯一主实现语言。**

---

## 2. 核心原则

### 2.1 Code-first for facts

以下内容必须由代码负责，不再依赖 AI 理解或推导：

- 参数解析
- 路径定位
- 文件存在性检查
- 头部解析
- `feature` 续接
- `progressFile` 校验
- task 调度
- task 状态迁移
- 并行 / 串行判定
- archive / restore
- pipeline 恢复起点判定
- gates 执行顺序

### 2.2 AI-only for ambiguity

只有以下高熵问题交给 AI：

- 整理需求事实，生成 requirement 正文
- 拆分任务与编写计划正文
- 实现单个 task 的代码 / 文档 / 配置改动
- 代码审查中的语义判断
- MR 标题 / 描述生成
- 复盘总结

### 2.3 AI 不拥有事实源

AI 可以消费事实，但不拥有事实的最终写权。

以下对象的写权必须固定在代码层：

- requirement 头部元信息
- `feature`
- `progressFile`
- `lastRun`
- task 状态
- archive 状态
- pipeline 当前阶段

### 2.4 AI 不驱动状态机

AI 不再负责判断：

- 下一批 task 是什么
- 当前 task 是否可恢复
- 是否允许并行
- 是否全部完成
- 下一步是 `check` 还是 `mr`

这些都由代码决定。

### 2.5 AI 输入最小化

AI 只接收完成当前任务所需的最小上下文，不再默认读取：

- 全量 rules
- 全量 `planDoc`
- 全量 `progressFile`
- 整条 pipeline 的所有状态

---

## 3. 目标架构

整体架构分为三层：

### 3.1 Engine 层

负责所有确定性事实与状态机。

建议承载对象：

- `src/scripts/lib/feature-header.ts`
- `src/scripts/lib/file-paths.ts`
- `src/scripts/lib/task-scheduler.ts`
- `src/scripts/lib/progress-ops.ts`
- `src/scripts/lib/progress-schema.ts`
- `src/scripts/lib/pipeline-state.ts`（新增）
- `src/scripts/lib/task-context.ts`（新增）

职责：

- 解析与校验
- 调度与状态迁移
- 路径与文件事实管理
- 结构化上下文提取

### 3.2 Orchestrator 层

每个主命令一个 orchestrator，负责主流程编排。

建议包含：

- `src/scripts/hx-plan.ts`
- `src/scripts/hx-run.ts`
- `src/scripts/hx-check.ts`
- `src/scripts/hx-mr.ts`
- `src/scripts/hx-go.ts`

职责：

- 串联 Engine 能力
- 决定何时调用 AI
- 控制阶段顺序
- 汇总结果并输出

### 3.3 AI Adapter 层

统一封装“如何把任务交给 AI”。

建议新增：

- `src/scripts/lib/ai-executor.ts`

职责：

- 接收结构化任务
- 生成最小 prompt
- 调用当前 agent / runtime
- 解析 AI 结果

---

## 4. 命令职责重划分

### 4.1 `hx doc`

代码负责：

- 读取来源
- 复用已有 `feature`
- 解析或生成 requirement 路径
- 固定写入头部元信息

AI 负责：

- 整理 requirement 正文

### 4.2 `hx plan`

代码负责：

- 读取 requirement
- 解析头部
- 选择模板
- 生成 `progressFile` 骨架
- 调用 schema 校验

AI 负责：

- 把 requirement 拆成 task
- 生成 `planDoc`
- 给出依赖与并行建议

### 4.3 `hx run`

代码负责：

- 解析参数
- 定位与校验 `progressFile`
- 自动 restore
- 计算 runnable / recoverable 批次
- `start / done / fail`
- 失败恢复
- 批次循环
- 收尾触发 `hx check`

AI 负责：

- 实现单个 task

### 4.4 `hx check`

代码负责：

- 收集 diff / checklist / gates
- 执行 lint / build / type / test
- 汇总检查事实

AI 负责：

- review / clean 的语义判断

### 4.5 `hx mr`

代码负责：

- 读取 requirement / progress / git facts
- 验证所有 task 是否完成
- 调用 archive

AI 负责：

- 生成 MR 标题与描述

### 4.6 `hx go`

代码负责：

- pipeline 状态机
- 自动恢复起点
- 调度 `doc / plan / run / check / mr`

AI 负责：

- 不直接参与 `hx go`
- 只在被子命令调用时参与

---

## 5. `hx run` 的目标状态机

`hx run` 是本次重构的核心。

### 5.1 现状

当前 `hx run`：

1. 定位 `progressFile`
2. 校验 `progressFile`
3. 计算当前批次
4. 打印：
   - `hx progress start`
   - 实现 task 的说明
   - `hx progress done / fail`

这仍然要求 AI 理解并手工驱动状态机。

### 5.2 目标行为

目标是让 `hx run` 直接成为编排器：

1. 解析参数
2. 定位并校验 `progressFile`
3. 计算当前批次
4. 对每个 task：
   - `startTask()`
   - 构造最小 task context
   - 调用 AI 执行 task
   - 成功则 `completeTask()`
   - 失败则 `failTask()`
5. 若未指定 `--plan-task`，继续循环下一批
6. 所有 task 完成后，触发质量检查
7. 输出结构化结果

### 5.3 目标伪代码

```js
function runFeature(feature, options) {
  const progressFile = resolveProgressFile(projectRoot, feature)
  validateProgressFile(progressFile)

  while (true) {
    const progressData = readProgressFile(progressFile)
    const batch = getScheduledBatch(progressData, options.planTask)

    if (batch.mode === 'done') break

    const results = runBatch(batch, {
      feature,
      progressFile,
      projectRoot,
    })

    if (results.blocked) return results
    if (options.planTask) break
  }

  return runQualityCheck(feature)
}
```

### 5.4 `runBatch` 规则

串行批次：

- 顺序执行 task
- 某个 task 失败时立即停止

并行批次：

- 允许多个 AI worker 并发
- 但 `progressFile` 写回必须安全串行化，或通过 merge 机制保证不会覆盖 sibling task

### 5.5 `--plan-task` 规则

`--plan-task` 只表示：

- 在完整 task 图中，限制本次只执行指定 task

不表示：

- 裁剪 `progressData.tasks`
- 修改调度语义
- 把其他 task 当成不存在

---

## 6. Task Context 设计

为了避免继续走 AI-first 的老路，`hx run` 不应把整份 `planDoc` 与 `progressFile` 直接丢给 AI。

建议新增 `task-context.ts`，输出统一结构：

```js
{
  feature: "AUTH-001",
  task: {
    id: "TASK-BE-01",
    name: "实现登录接口",
    goal: "...",
    scope: ["src/api/auth.js", "src/services/user.js"],
    implementationNotes: ["..."],
    acceptance: ["..."],
    verification: ["npm run hx:test:unit"]
  },
  requirement: {
    summary: "...",
    constraints: ["..."]
  },
  dependencies: [
    {
      id: "TASK-BE-00",
      name: "准备鉴权中间件",
      output: "..."
    }
  ],
  checkpointFeedback: null
}
```

### 6.1 允许给 AI 的内容

- 当前 task 的目标
- 当前 task 的范围
- 当前 task 的验收标准
- 必要的 requirement 摘要
- 直接依赖 task 的完成摘要
- 必要的文件路径提示

### 6.2 不默认给 AI 的内容

- 全量 `progressFile`
- 全量 `planDoc`
- 全量 rules
- 全量 pipeline
- 历史所有 task

---

## 7. AI Executor 接口

建议统一通过 `ai-executor.ts` 调用 AI，而不是在各命令里散落拼 prompt 的代码。

### 7.1 推荐接口

```js
await runAiTask({
  kind: 'implement-task',
  feature,
  payload: taskContext,
})
```

```js
await runAiTask({
  kind: 'review',
  feature,
  payload: reviewContext,
})
```

```js
await runAiTask({
  kind: 'generate-mr',
  feature,
  payload: mrContext,
})
```

### 7.2 返回值建议

```js
{
  ok: true,
  summary: "新增登录接口与单测",
  artifacts: {},
  warnings: []
}
```

或：

```js
{
  ok: false,
  exitStatus: "blocked",
  reason: "缺少接口字段定义"
}
```

### 7.3 Prompt 生成原则

- 最小化输入
- 结构化事实优先
- 不重复框架规则
- 不要求 AI 推导状态机

---

## 8. 命令契约调整原则

重构后，`src/commands/hx-*.md` 的职责会进一步收缩。

### 8.1 保留内容

- 目标
- AI 角色
- 高层边界
- 必要约束

### 8.2 删除内容

- 状态机细节
- 路径推导细节
- 调度算法细节
- 写回字段细节
- AI 手工调用确定性子命令的分步说明

### 8.3 结论

命令契约应描述：

> “当代码 orchestrator 调到这里时，AI 需要承担什么职责”

而不再描述：

> “AI 如何亲自驱动整个命令执行”

---

## 9. 迁移步骤

### Phase 1：收口当前半迁移状态

- 修复当前单测失败
- 让 `hx-run.md` / `hx-go.md` / `hx-mr.md` 与测试重新一致
- 修复已知 review 问题：
  - 并行回写互相覆盖
  - `--plan-task` 错误裁剪 task 图
  - 头部解析范围过宽
  - `hx progress start` 未校验依赖
  - `hx status` 提示命令名错误

### Phase 2：抽 Task Context

- 新增 `task-context.ts`
- 先把 `hx run` 的 AI 输入从“整份文档”缩成“单 task 最小上下文”

### Phase 3：重写 `hx-run.js`

- 从“输出命令说明”改成“实际执行状态机”
- 仍保留 `hx progress` 作为底层能力和调试工具

### Phase 4：抽 `ai-executor.js`

- 把 AI 接口统一起来
- 让 `hx plan / hx check / hx mr` 逐步接入统一 AI 调用方式

### Phase 4.5：统一到 Bun + TypeScript

- 将核心脚本从 `.js` 迁移到 `.ts`
- 增加 `tsconfig.json`
- 统一命令入口到 `bun`
- 将测试入口逐步从 `vitest` 迁移或收口到 `bun test`
- 更新 `package.json` / bin / 发布产物策略

### Phase 5：瘦命令契约

- 让 `hx-*.md` 只保留 AI 角色说明
- 把共享事实继续迁回代码

---

## 10. 兼容策略

为降低迁移风险，保留以下兼容层：

- `hx progress` 继续可独立调用
- `hx feature parse` 继续保留
- `hx archive` / `hx restore` 继续保留
- `hx status` 继续保留

也就是说：

- 主链路优先由 orchestrator 调用这些 deterministic 工具
- 但用户和调试流程仍可单独执行这些命令

---

## 11. 风险与注意事项

### 11.1 并行写回风险

如果 `hx run` 支持并行 task，必须先解决 `progressFile` 的安全写回问题。

建议方案：

- 写回串行化
- 或基于最新文件快照做字段级 merge

在未解决前，不应默认开启并行状态写回。

### 11.2 AI 执行接口风险

如果 `ai-executor.js` 没有稳定协议，主流程会再次退回到“打印 prompt，人工拼接”。

因此必须尽早定义：

- 输入结构
- 输出结构
- 成功 / 失败协议

### 11.3 文档与代码漂移

迁移期间，最容易出现的问题是：

- 代码已经切到 orchestrator
- 命令契约仍在描述旧流程

因此每次阶段性完成后都要同步：

- `src/commands/*.md`
- `src/contracts/*.md`
- `tests/unit/command-contracts.test.js`

---

## 12. 验收标准

当以下条件同时满足时，视为本次架构切换完成：

1. `hx run` 可在代码层完整驱动 task 状态机
2. AI 只接收单个 task 的最小上下文
3. `progressFile` 不再依赖 AI 手工修改
4. `hx go` 只做代码调度，不要求 AI 理解 pipeline 状态
5. 命令契约不再承担状态机职责
6. 单测与集成测试能覆盖主链路的确定性部分

---

## 13. 一句话总结

HXFlow 的重构方向不是“继续优化 prompt”，而是：

> **把工作流还原为代码系统，把 AI 收缩为工作流中的高熵执行器。**

这是从 AI-first 到 code-first 的根本切换。
