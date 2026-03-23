# Harness Engineering — Claude Code 项目配置

## 项目概述

本项目是 Harness Engineering 需求开发规范的工具仓库，包含规范文档和脚手架代码。
核心理念：工程师不直接写业务代码，而是通过结构化文档 + Agent 执行的方式交付。

## 架构层级（单向依赖）

Types → Config → Repo → Service → Runtime → UI

每一层只能导入其左侧的层，违反由 CI 自动阻断。

## 工作流命令（按阶段顺序）

| 命令 | 阶段 | 用途 |
|------|------|------|
| `/hx-doc <feature>` | Phase 01 | 创建需求文档并引导填写 AC |
| `/hx-plan <feature>` | Phase 02 | 生成执行计划，拆分 TASK-XX |
| `/hx-ctx` | Phase 03 | 校验上下文完整性（AGENTS.md、文档链接） |
| `/hx-run <role> <task-id>` | Phase 04 | 按 TASK-ID 驱动 Agent 执行 |
| `/hx-review` | Phase 05 | 按团队规范审查当前 diff |
| `/hx-gate` | Phase 04/06 | 运行 lint + typecheck + test 门控 |
| `/hx-fix` | Phase 05 | 读取 Review 意见自动修复 |
| `/hx-done <task-id>` | 收尾 | 标记任务完成，更新进度 |
| `/hx-entropy` | Phase 07 | 双周熵扫描，输出清理报告 |

## 关键文件

- `harness-scaffold/AGENTS.md` — Agent 上下文索引（≤100 行）
- `harness-scaffold/docs/golden-principles.md` — 黄金原则
- `harness-scaffold/docs/map.md` — 架构全图
- `harness-scaffold/docs/design/` — 需求设计文档
- `harness-scaffold/docs/plans/` — 执行计划与进度 JSON

## 执行规则

1. 每个 TASK 独立开会话执行，不在同一会话连续执行多个 TASK
2. 所有代码必须通过 `hx:gate`（lint + typecheck + test）
3. 错误使用 AppError 类，禁止裸 throw new Error
4. 禁止 console.log 进入 src/，使用结构化 logger
5. 执行前必须读取 `AGENTS.md` 和 `golden-principles.md`
