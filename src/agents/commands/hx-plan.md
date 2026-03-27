---
name: hx-plan
description: Phase 02 · 生成执行计划
usage: hx-plan [<feature-key>] [--profile <name>]
claude: /hx-plan
codex: hx-plan
---

# Phase 02 · 生成执行计划

参数: `$ARGUMENTS`（格式: `[<feature-key>] [--profile <name>]`）

## 执行步骤

1. 解析参数：提取可选 `feature-key`，`--profile`（可选）
2. 确定 `feature key`：
   - 若传入 `feature-key`，直接作为当前需求的内部主键
   - 若未传入，则优先使用当前会话中最近一次 `hx-doc` 创建的目标需求文档
   - 从目标需求文档头部读取 `Feature Key：<feature-key>`；若读取成功，则用该值作为后续 `paths.*` 的 `{feature}`
   - 若未传入参数且无法唯一确定目标需求文档，或文档头缺少 `Feature Key`，则停止并要求用户补充 `feature-key`
   - 读取到的 `feature key` 必须视为项目内唯一内部主键；若同 key 指向多个不同需求来源，停止继续并要求人工消歧
   - 正常成功路径不需要把 `feature key` 回显给用户；只有自动定位失败时再显式提示
3. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，以下字段缺失时使用默认值，将 `{feature}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.planDoc` | `docs/plans/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |

4. 解析 Profile：
   - 优先 `--profile`；否则回退 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<name>/` → `~/.hx/profiles/<name>/` → 框架内置 `profiles/<name>/`
5. 加载前置 Hook（`plan-pre.md`，存在则作为拆分策略约束）
6. 读取 `requirementDoc`，提取：
   - 验收条件（AC）
   - 勾选的架构层级
   - 文档头中的 `Feature Key`
7. 加载 profile 的 `task-split-strategy.md`（如有），按策略拆分任务
8. 写入 `planDoc`（计划 Markdown，含 TASK 列表）
9. 写入 `progressFile`，严格按以下 schema，不得增减字段：

```json
{
  "feature": "<feature-key>",
  "profile": "<profile-name>",
  "generatedAt": "<ISO 8601 date>",
  "updatedAt": "<ISO 8601 date>",
  "lastRun": null,
  "tasks": [
    {
      "id": "TASK-BE-01",
      "name": "任务名称",
      "status": "pending",
      "completedAt": null
    }
  ]
}
```

字段约束：
- `feature`：string，当前需求的 feature key
- `profile`：string，本次使用的 profile 名称
- `generatedAt`：string（ISO 8601 date），文件首次生成日期，写入后不再修改
- `updatedAt`：string（ISO 8601 date），每次写入文件时更新为当天日期
- `lastRun`：object 或 `null`，初始为 `null`；每次 `hx-run` 执行后更新，结构见下方
- `tasks`：array，顺序与 `planDoc` 中 TASK 列表一致，只记录执行状态，不冗余计划内容
- `tasks[].id`：string，格式 `TASK-<TEAM>-<NN>`
- `tasks[].name`：string，任务名称
- `tasks[].status`：enum，只允许 `"pending"` 或 `"done"`，初始全部为 `"pending"`
- `tasks[].completedAt`：string（ISO 8601）或 `null`，初始全部为 `null`

`lastRun` 结构（由 `hx-run` 写入）：
```json
{
  "at": "<ISO 8601 date>",
  "status": "completed | blocked",
  "taskId": "<最后执行的 task id>",
  "reason": "<仅 blocked 时填写，说明阻塞原因>"
}
```
10. 加载后置 Hook 并执行（`plan-post.md`）
11. 输出计划摘要，默认提示下一步 `hx-run`；若用户需要排查输入问题，再提示可选执行 `hx-ctx`

## 约束

- 不覆盖已存在的计划文件（提示用户确认）
- 每个 TASK 必须包含：id、名称、所属架构层、估算、验收标准
- TASK-id 格式：`TASK-<TEAM>-<NN>`（如 `TASK-BE-01`、`TASK-FE-03`）
- 若省略 `feature-key`，只能在“当前目标需求文档唯一且文档头含 Feature Key”时自动继续
- 若发现 `feature key` 与其他需求发生冲突，必须先修正文档主键，再生成计划
