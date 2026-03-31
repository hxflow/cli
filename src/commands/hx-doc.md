---
name: hx-doc
description: Phase 01 · 获取需求并创建需求文档
usage: hx-doc [<feature-key-or-title>] [--task <task-id>]
hooks:
  - pre
  - post
---

# Phase 01 · 获取需求并创建需求文档

参数: `$ARGUMENTS`（格式: `[<feature-key-or-title>] [--task <task-id>]`）

## 执行步骤

1. 解析参数，提取可选的位置参数和 `--task`。
2. 判断需求来源：
   - 传入 `--task <task-id>` 时，按任务信息整理需求
   - 未传入 `--task` 时，按当前输入整理需求
3. 生成需求标题和 `feature key`。
4. 读取 `.hx/config.yaml` 中的 `paths.requirementDoc`。
5. 读取 `rules/golden-rules.md` 和 `rules/requirement-template.md`。
6. 基于模板创建 `requirementDoc`。
7. 输出创建结果，并提示下一步运行 `hx-plan`。

## 约束

- 只读取当前项目规则与配置
- 缺少需求来源时停止，不能凭空补齐关键约束
- `feature key` 仍是内部主键，用于串联需求、计划和进度文件
