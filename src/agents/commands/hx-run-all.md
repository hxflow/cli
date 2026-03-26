# 批量执行所有待完成任务

参数: `$ARGUMENTS`（格式: `<feature-name> [--profile <team[:platform]>]`）

## 前提条件

需求文档和执行计划已存在（已完成 Phase 01-02）。若未完成，先运行 `/hx-doc` 和 `/hx-plan`。

## 执行步骤

1. 解析 Profile（`--profile` 或 `.hx/config.yaml` 的 `defaultProfile`）
2. 解析路径：读取合并后的 `paths` 配置，将 `{feature}` 替换为实际值（默认值同 `/hx-run`）
3. 读取上下文：
   - `AGENTS.md`（或 `paths.agents`）
   - `docs/golden-principles.md`
   - profile 的 `golden-rules.md`
   - `requirementDoc`
   - `planDoc`
   - `progressFile`
3. 按照 `/hx-ctx` 指令校验上下文完整性，有问题则停止
4. 找出所有 `pending` 任务，按顺序逐一执行：
   - 按照 `/hx-run` 的方式执行该任务
   - 每完成一个任务立即更新 progress.json 状态为 `done`
   - 每个任务完成后运行 `/hx-gate`，失败则按 `/hx-fix` 修复后再继续
5. 所有任务完成后执行最终 `/hx-gate`
6. 按照 `/hx-review` 审查全部变更并输出报告

## 约束

- 每个任务独立执行，严格遵守架构层级依赖
- 不跨任务边界修改代码
- 已完成（`done`）的任务跳过，不重复执行
