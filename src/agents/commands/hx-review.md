# Phase 05 · 输出审查清单

参数: `$ARGUMENTS`（可选: `--profile <team[:platform]>`）

## 当前实现

`hx:review` 当前不会自动审查 diff，而是直接打印对应 profile 的 review checklist，供人工或 Agent 复核时使用。

profile 解析顺序：

1. `--profile`
2. `.hx/config.json.defaultProfile`
3. CLI 默认值

输出内容来自：

- 当前 Profile 对应的 `review-checklist.md`
- 如有平台附加检查，再追加 `reviewExtra`

## Hook 注入

在输出审查清单前后，检查以下 hook 文件（存在则读取内容并注入）：

**前置 Hook（pre）**——在审查前注入额外检查维度或约束：
- `~/.hx/hooks/review-pre.md`（用户全局）
- `.hx/hooks/review-pre.md`（项目级）

**后置 Hook（post）**——审查完成后执行额外指令（如自动提交、通知等）：
- `~/.hx/hooks/review-post.md`（用户全局）
- `.hx/hooks/review-post.md`（项目级）

也可在 `.hx/config.json` 的 `hooks.review.pre` / `hooks.review.post` 数组中声明额外路径。

## 典型用法

```bash
npm run hx:review -- --profile backend
```
