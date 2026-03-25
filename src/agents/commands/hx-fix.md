# Phase 05 · 生成修复 Prompt

参数: `$ARGUMENTS`（格式: `[--profile <team[:platform]>] [--log <text>] [--file <path>]`）

## 当前实现

`hx:fix` 会根据错误日志生成一段可复制的修复 Prompt，不会直接读取 PR 评论或自动修改代码。

日志来源优先级：

1. `--file <path>`
2. `--log "<text>"`
3. 自动执行 `npm run hx:test` 并截取最后一段输出

生成 Prompt 时会自动带上：

- `AGENTS.md`
- `docs/golden-principles.md`
- 当前 Profile 对应的 `golden-rules.md`
- 当前错误日志

## Hook 注入

在生成修复 Prompt 前后，检查以下 hook 文件（存在则读取内容并注入）：

**前置 Hook（pre）**——注入到修复 prompt 开头，作为额外修复约束：
- `~/.hx/hooks/fix-pre.md`（用户全局）
- `.hx/hooks/fix-pre.md`（项目级）

**后置 Hook（post）**——追加到修复 prompt 末尾：
- `~/.hx/hooks/fix-post.md`（用户全局）
- `.hx/hooks/fix-post.md`（项目级）

也可在 `.hx/config.json` 的 `hooks.fix.pre` / `hooks.fix.post` 数组中声明额外路径。

## 输出示例

```text
════════════════════════════════════════════════════════════
  Bug 修复 Prompt 生成器 (前端)
════════════════════════════════════════════════════════════
```
