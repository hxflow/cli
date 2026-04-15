---
name: hx
description: "Harness Workflow — 需求到交付的全自动流水线框架。当用户说 /hx、hx doc、hx plan、hx run、hx go 等触发词时使用。支持需求获取、计划生成、任务执行、质量检查、MR 创建的完整工作流。"
compatibility: "Requires bun runtime"
metadata:
  generator: hxflow
  version: "4.0.0"
---

# Harness Workflow

先读取 [运行时契约](src/contracts/runtime-contract.md)，按其规则读取默认 contracts。

## 路由

根据 `$ARGUMENTS` 的第一个词匹配命令，读取对应命令文件后执行（剩余参数原样透传）：

| 命令 | 文件 | 说明 |
|------|------|------|
| doc | [src/commands/hx-doc.md](src/commands/hx-doc.md) | 获取需求并创建需求文档 |
| plan | [src/commands/hx-plan.md](src/commands/hx-plan.md) | 生成执行计划 |
| run | [src/commands/hx-run.md](src/commands/hx-run.md) | 执行需求 |
| fix | [src/commands/hx-fix.md](src/commands/hx-fix.md) | 修复错误 |
| check | [src/commands/hx-check.md](src/commands/hx-check.md) | 质量检查 |
| mr | [src/commands/hx-mr.md](src/commands/hx-mr.md) | 创建 Merge Request |
| go | [src/commands/hx-go.md](src/commands/hx-go.md) | 全自动流水线 |
| init | [src/commands/hx-init.md](src/commands/hx-init.md) | 初始化项目 |
| rules | [src/commands/hx-rules.md](src/commands/hx-rules.md) | 查看或更新规则 |
| status | [src/commands/hx-status.md](src/commands/hx-status.md) | 查看任务进度 |

无参数时默认执行 `go`。未匹配到命令时提示可用命令列表。
