# Phase 08 · 创建 Merge Request

参数: `$ARGUMENTS`（格式: `<feature-name> [--project <group/repo>] [--target <branch>]`）

## 执行步骤

1. 解析参数：`feature-name`、`--project`（可选）、`--target`（默认 `main`）
2. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段，将 `{feature}` 替换为实际值：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |

3. 加载前置 Hook（`mr-pre.md`，存在则作为 MR 模板补充要求注入）
4. 读取事实来源：
   - `requirementDoc`（需求、AC）
   - `progressFile`（任务完成状态）
   - `git log <target>..HEAD --oneline`（提交列表）
   - `git diff <target>...HEAD --stat`（变更概览）
4. 生成 MR 内容：
   - **标题**：简洁描述，格式 `feat: <feature-name> - <一句话摘要>`
   - **需求背景**：来自需求文档摘要
   - **变更说明**：按架构层级列出改动
   - **AC 验收清单**：来自需求文档，逐条标注完成状态
   - **任务完成情况**：`N/N 个任务完成`，列出 TASK 列表
   - **测试说明**：新增或修改的测试文件
5. 加载后置 Hook 并执行（`mr-post.md`）
6. 输出格式化的 MR 描述（Markdown），供复制到 GitLab/GitHub

## Hook 路径

- `~/.hx/hooks/mr-pre.md` / `.hx/hooks/mr-pre.md`
- `~/.hx/hooks/mr-post.md` / `.hx/hooks/mr-post.md`
- `.hx/config.yaml` 的 `hooks.mr.pre` / `hooks.mr.post` 列表
