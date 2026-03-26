# Phase 04 · 执行任务

参数: `$ARGUMENTS`（格式: `<feature-name> <task-id> [--profile <team[:platform]>]`）

## 执行步骤

1. 解析参数：`feature-name`、`task-id`、`--profile`
2. 解析 Profile：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<team>/` → `~/.hx/profiles/<team>/` → 框架内置 `profiles/<team>/`
   - 处理 `extends:` 继承，合并架构层级与门控配置
3. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，以下字段缺失时使用默认值，将 `{feature}` 和 `{taskId}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.planDoc` | `docs/plans/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |
   | `paths.taskDoc` | （空，不使用）|

4. 读取上下文（按顺序）：
   - `AGENTS.md`（或 `paths.agents`）
   - `docs/golden-principles.md`
   - profile 的 `golden-rules.md`
   - `requirementDoc`（需求文档）
   - `planDoc`（定位目标 task 条目）
   - `progressFile`（确认任务状态为 `pending`）
   - 若 `taskDoc` 已配置且文件存在，额外读取（作为补充执行上下文）
5. 加载前置 Hook（`run-pre.md`，存在则注入为额外约束）
6. 按任务的验收标准、架构层级约束直接执行（编写代码）
7. 执行完成后更新进度文件：
   - `progressFile` 中目标任务 `status → done`，写入 `completedAt`
8. 加载后置 Hook（`run-post.md`，存在则执行额外指令）

## 执行约束

- 任务状态不是 `pending` 时拒绝执行，提示当前状态
- 严格遵守 profile 定义的架构层级（只能导入内层）
- 不修改其他任务的代码（当前 task 范围内作业）
- 错误使用 `AppError` 类，禁止裸 `throw new Error`
- 禁止 `console.log` 进入 `src/`，使用结构化 logger

## Hook 路径

- `~/.hx/hooks/run-pre.md` / `.hx/hooks/run-pre.md`
- `~/.hx/hooks/run-post.md` / `.hx/hooks/run-post.md`
- `.hx/config.yaml` 的 `hooks.run.pre` / `hooks.run.post` 列表
