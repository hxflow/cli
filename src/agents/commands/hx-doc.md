# Phase 01 · 创建需求文档

参数: `$ARGUMENTS`（格式: `<feature-name> [--task <task-id>] [--profile <team[:platform]>]`）

## 执行步骤

1. 解析参数：提取 `feature-name`（强制 kebab-case），`--task`（可选），`--profile`（可选）
2. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，以下字段缺失时使用默认值，将 `{feature}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |

3. 解析 Profile：
   - 优先 `--profile`；否则读 `.hx/config.yaml` 的 `defaultProfile`
   - 按顺序查找：`.hx/profiles/<team>/` → `~/.hx/profiles/<team>/` → 框架内置 `profiles/<team>/`
   - 读取 `profile.yaml`，处理 `extends:` 继承链
4. 加载前置 Hook（存在则作为额外约束）：
   - `~/.hx/hooks/doc-pre.md`、`.hx/hooks/doc-pre.md`
   - `.hx/config.yaml` 的 `hooks.doc.pre` 路径列表
5. 从 profile 目录读取 `requirement-template.md`
6. 基于模板创建 `requirementDoc`：
   - 自动填入当前日期、team/platform 信息
   - 若提供 `--task`，在文档头部写入 `来源任务：DevOps #<task-id>`
7. 加载后置 Hook 并执行额外指令（`doc-post.md`）
8. 输出：`✓ 需求文档已创建: <requirementDoc 路径>`，提示下一步 `/hx-plan`

## 约束

- `requirementDoc` 所在目录不存在则自动创建
- 不修改已存在的同名文档（提示用户确认后再覆盖）
- feature-name 必须是 kebab-case，否则报错
