---
name: hx-run
description: Phase 04 · 执行需求
usage: hx-run [<feature>] [--plan-task <task-id>]
hooks:
  - pre
  - post
---

# Phase 04 · 执行需求

## 目标

执行当前 feature 的可运行任务。

## 使用方式

```bash
hx run <feature> [--plan-task <task-id>]
```

`hx run` 会自动完成以下工作，并输出精确的执行指令：
- 定位并校验 progressFile
- 计算当前批次（恢复中断 / 执行新任务 / 全部完成）
- 输出每个任务的阶段一 / 阶段二 / 阶段三调用命令

## AI 职责：阶段二 — 实现任务内容

收到 `hx run` 的输出后，对每个任务：

1. 调用输出中指定的 `hx progress start` 命令（锁定 in-progress）
2. 阅读 planDoc 中对应 task 的实施要点
3. 实现代码、文档或配置变更

**实现质量标准：**
- 只改动与任务边界相关的内容，不引入无关变更
- 遵守 `rules/golden-rules.md` 中的约束
- 每个 task 实现完成后，立即调用 `hx progress done` 或 `hx progress fail`

## 故障处理

- progressFile 不存在：先运行 `hx plan <feature>`
- 校验失败：检查 progressFile 结构后重试
- 任务阻断（blocked）：输出阻断原因，等待人工介入后再重试

## 约束

- `--plan-task <task-id>` 只限制本次目标 task，不改变完整任务图
- 调度与状态写回全部通过 `hx progress` 的确定性能力完成
- AI 只负责 task 实现，不自行修改 `progressFile`
