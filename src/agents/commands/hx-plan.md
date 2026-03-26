# Phase 02 · 生成执行计划

参数: `$ARGUMENTS`（格式: `<feature-name> [--profile <team[:platform]>]`）

## 执行步骤

1. 解析参数：提取 `feature-name`，`--profile`（可选）
2. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，以下字段缺失时使用默认值，将 `{feature}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.planDoc` | `docs/plans/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |

3. 解析 Profile：
   - 优先 `--profile`；否则读 `requirementDoc` 的团队/平台标签；再回退 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<team>/` → `~/.hx/profiles/<team>/` → 框架内置 `profiles/<team>/`
4. 加载前置 Hook（`plan-pre.md`，存在则作为拆分策略约束）
5. 读取 `requirementDoc`，提取：
   - 验收条件（AC）
   - 勾选的架构层级
6. 加载 profile 的 `task-split-strategy.md`（如有），按策略拆分任务
7. 写入 `planDoc`（计划 Markdown，含 TASK 列表）
8. 写入 `progressFile`（所有任务初始状态为 `pending`）
9. 更新 `AGENTS.md` 的活跃特性区块（追加或更新当前 feature 条目）
10. 加载后置 Hook 并执行（`plan-post.md`）
11. 输出计划摘要，提示下一步 `/hx-ctx` 和 `/hx-run`

## 约束

- 不覆盖已存在的计划文件（提示用户确认）
- 每个 TASK 必须包含：id、名称、所属架构层、估算、验收标准
- TASK-id 格式：`TASK-<TEAM>-<NN>`（如 `TASK-BE-01`、`TASK-FE-03`）
