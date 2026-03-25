# Phase 02 · 生成执行计划

参数: `$ARGUMENTS`（格式: `<feature-name> [--profile <team[:platform]>]`）

## 当前实现

`hx:plan` 会读取需求文档并生成计划 Markdown 与进度 JSON。

执行逻辑：

1. 校验 `feature-name`
2. 解析 profile：
   - 优先 `--profile`
   - 否则尝试从 `docs/requirement/<feature>.md` 的团队/平台标签推断
   - 再回退到 `.hx/config.json.defaultProfile`
3. 读取 `docs/requirement/<feature>.md`
4. 提取 AC 与勾选的架构层级
5. 根据 profile 的 `task_split` 规则生成任务
6. 写入：
   - `docs/plans/<feature>.md`
   - `docs/plans/<feature>-progress.json`
7. 更新根目录 `AGENTS.md` 的活跃特性区块

## Hook 注入

在生成执行计划前后，检查以下 hook 文件（存在则读取内容并注入）：

**前置 Hook（pre）**——在计划生成前读取，作为拆分策略的额外约束：
- `~/.hx/hooks/plan-pre.md`（用户全局）
- `.hx/hooks/plan-pre.md`（项目级）

**后置 Hook（post）**——计划生成完成后执行额外指令：
- `~/.hx/hooks/plan-post.md`（用户全局）
- `.hx/hooks/plan-post.md`（项目级）

也可在 `.hx/config.json` 的 `hooks.plan.pre` / `hooks.plan.post` 数组中声明额外路径。

## 输出示例

```text
✓ 执行计划已创建:
  docs/plans/user-login.md（5 个任务）
  docs/plans/user-login-progress.json
  AGENTS.md 已登记为活跃特性

下一步:
  hx ctx --profile backend
  hx run user-login TASK-BE-01 --profile backend
```
