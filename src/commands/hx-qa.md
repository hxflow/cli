---
name: hx-qa
description: Phase 06 · 质量校验
usage: hx-qa
---

# Phase 06 · 质量校验

参数: `$ARGUMENTS`（本命令不接受额外参数）

## 执行步骤

1. 读取 `.hx/config.yaml` 中的 `gates`。
2. 过滤掉值为空的 gate。
3. 按顺序执行：`lint -> build -> type -> test`。
4. 任一步骤失败立即停止并报告错误详情。
5. 全部通过后输出 `质量校验全部通过`。

## 约束

- 质量门命令只来自 `config.gates`
- 只读取当前项目的结构化配置
- 至少需要一个 gate，缺失时直接报错
