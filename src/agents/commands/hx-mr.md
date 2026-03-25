# Phase 08 · 创建 Merge Request

参数: `$ARGUMENTS`（格式: `<feature-name> [--project <group/repo>] [--target <branch>]`）

## 文档约定

生成 MR 描述时，特性上下文默认来自：

- `docs/requirement/<feature>.md`
- `docs/plans/<feature>-progress.json`
- 当前分支的 `git log` 与 `git diff`

如果命令需要附带 AC、任务完成状态或影响层级，以上两个文档是首选事实来源。

## Hook 注入

在生成 MR 描述前后，检查以下 hook 文件（存在则读取内容并注入）：

**前置 Hook（pre）**——注入 MR 模板补充要求或提交规范：
- `~/.hx/hooks/mr-pre.md`（用户全局）
- `.hx/hooks/mr-pre.md`（项目级）

**后置 Hook（post）**——MR 描述生成后执行额外指令：
- `~/.hx/hooks/mr-post.md`（用户全局）
- `.hx/hooks/mr-post.md`（项目级）

也可在 `.hx/config.json` 的 `hooks.mr.pre` / `hooks.mr.post` 数组中声明额外路径。
