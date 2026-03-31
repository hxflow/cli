---
name: hx-fix
description: Phase 05 · 修复错误
usage: hx-fix [--log <text>] [--file <path>]
hooks:
  - pre
  - post
---

# Phase 05 · 修复错误

参数: `$ARGUMENTS`（格式: `[--log <text>] [--file <path>]`）

## 执行步骤

1. 获取错误上下文（优先级从高到低）：
   - `--file <path>`
   - `--log <text>`
   - 自动运行已配置的 `test` gate 并截取失败输出
2. 读取 `rules/golden-rules.md`。
3. 根据错误上下文定位相关源文件并直接修复。
4. 运行 `hx-qa` 验证修复结果。

## 约束

- 不修改已有函数签名（参数与返回类型）
- 不修改现有测试的期望值（测试是行为契约）
- 修复后补充一个能复现此 Bug 的回归测试
