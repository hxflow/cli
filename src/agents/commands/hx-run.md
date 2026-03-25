# Phase 04 · 生成 Agent Prompt

参数: `$ARGUMENTS`（格式: `<feature-name> <task-id> [--profile <team[:platform]>]`）

## 当前实现

`hx:run` 当前不会直接执行代码任务，而是读取上下文后输出一段可复制给 Claude / Codex 的 Prompt。

执行逻辑：

1. 根据 `feature-name + task-id` 或单独 `task-id` 查找 `docs/plans/*-progress.json`
2. 解析 profile：
   - 优先 `--profile`
   - 否则取 progress 中的 `profile`
   - 再回退到 `.hx/config.json.defaultProfile`
3. 读取并引用以下上下文：
   - `AGENTS.md`
   - `docs/golden-principles.md`
   - 当前 Profile 对应的 `golden-rules.md`
   - 当前 Profile 对应的 `profile.yaml`
   - `docs/plans/<feature>.md`
   - `docs/requirement/<feature>.md`
4. 如果任务已是 `done`，直接提示，不再生成执行 Prompt

## Hook 注入

在输出 Agent Prompt 前后，检查以下 hook 文件（存在则读取内容并注入到 prompt 对应位置）：

**前置 Hook（pre）**——注入到 prompt 开头：
- `~/.hx/hooks/run-pre.md`（用户全局）
- `.hx/hooks/run-pre.md`（项目级，优先级更高）

**后置 Hook（post）**——追加到 prompt 末尾：
- `~/.hx/hooks/run-post.md`（用户全局）
- `.hx/hooks/run-post.md`（项目级，优先级更高）

也可在 `.hx/config.json` 的 `hooks.run.pre` / `hooks.run.post` 数组中声明额外文件路径。

## 输出示例

```text
════════════════════════════════════════════════════════════
  Agent Prompt — TASK-BE-03 (服务端)
  复制下方内容，粘贴给 Claude/Codex 执行
════════════════════════════════════════════════════════════
```
