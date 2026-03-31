---
name: hx-review
description: Phase 05 · 代码审查
usage: hx-review
hooks:
  - pre
  - post
---

# Phase 05 · 代码审查

参数: `$ARGUMENTS`（本命令不接受额外参数）

## 执行步骤

1. 获取当前变更 diff，优先 `git diff HEAD`，无暂存时回退 `git diff`。
2. 读取 `rules/golden-rules.md` 和 `rules/review-checklist.md`。
3. 逐项对照 checklist 审查：
   - 范围与一致性
   - 架构与分层检查
   - 错误处理与健壮性
   - 测试与质量门
   - 技术栈专项检查
4. 输出审查结论和问题列表。

## 约束

- 只依赖当前项目规则和实际 diff
- 审查结论以实际 diff 为准，不以口头描述代替
