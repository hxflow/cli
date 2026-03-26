# Harness Engineering — Claude Code 项目配置

## 项目概述

本项目是 Harness Engineering 需求开发规范的 workflow framework，包含规范文档、Profile 系统和流程命令。
核心理念：工程师不直接写业务代码，而是通过结构化文档 + Agent 执行的方式交付。

## 三层架构

配置和命令按三层优先级查找，高优先级覆盖低优先级：

```
系统层  <frameworkRoot>/src/agents/   命令实体、profiles（git pull 升级）
用户层  ~/.hx/                        用户自定义覆盖（跨项目共享）
项目层  <project>/.hx/               项目专属覆盖（最高优先级）
```

每层结构一致：`commands/`、`profiles/`、`skills/`、`pipelines/`、`config.yaml`

**覆盖规则：**
- commands / profiles / skills / pipelines — 找到第一个存在的文件即使用
- `config.yaml` — 三层字段级 merge，项目层字段覆盖用户层，用户层覆盖系统层

## Profile 系统

所有命令支持 `--profile` 参数指定团队配置：
```
--profile backend           # 服务端
--profile frontend          # 前端
--profile mobile:ios        # 移动端 iOS
--profile mobile:android    # 移动端 Android
--profile mobile:harmony    # 移动端 HarmonyOS
```

Profile 查找顺序：`<project>/.hx/profiles/` → `~/.hx/profiles/` → 框架内置 `profiles/`

## 安装与维护

通过 `hx` CLI 管理框架的安装、升级和卸载：

| 命令 | 用途 |
|------|------|
| `hx setup` | **首次安装**：生成转发器到 `~/.claude/commands/`，初始化 `~/.hx/` 目录结构 |
| `/hx-init` | **项目初始化**：分析项目结构，写入 `.hx/config.yaml`，注入 CLAUDE.md 标记块 |
| `hx upgrade [--dry-run]` | **升级系统层**：git pull 框架 repo，重新生成转发器 |
| `hx uninstall [--yes]` | 移除安装痕迹（转发器、标记块） |

**配置优先级（低 → 高）：** 系统层默认值 → `~/.hx/config.yaml` → `<project>/.hx/config.yaml`

## 工作流命令

### 一键自动化（推荐）

| 命令 | 用途 |
|------|------|
| `/hx-go <feature> [--task <id>] [--from <step-id>] --profile <team>` | **全自动流水线**：读取 pipeline YAML 驱动，默认 Phase 01→08，支持 `--from` 从指定阶段恢复 |
| `/hx-run-all <feature> --profile <team>` | **批量执行**：跳过 01-02，执行所有 pending TASK + 审查 + 门控 |

### 单步命令（手动控制）

| 命令 | 阶段 | 用途 |
|------|------|------|
| `/hx-doc <feature> [--task <id>] --profile <team>` | Phase 01 | 创建需求文档（团队模板） |
| `/hx-plan <feature> --profile <team>` | Phase 02 | 生成执行计划（按团队策略拆分 TASK） |
| `/hx-ctx [--profile <team>]` | Phase 03 | 校验上下文 + Profile 文件完整性 |
| `/hx-run <feature> <task-id> --profile <team>` | Phase 04 | 按 TASK-ID 驱动 Agent 执行 |
| `/hx-review [--profile <team>]` | Phase 05 | 按团队审查清单审查 diff |
| `/hx-gate [--profile <team>]` | Phase 04/06 | 运行团队对应的门控命令 |
| `/hx-fix [--profile <team>]` | Phase 05 | 读取 Review 意见按团队规范修复 |
| `/hx-done <task-id>` | 收尾 | 标记任务完成，更新进度 |
| `/hx-entropy [--profile <team>]` | Phase 07 | 熵扫描（全局 + 团队专项） |
| `/hx-mr <feature> [--project <path>]` | Phase 08 | 输出 MR 创建上下文 |

## 关键文件

- `AGENTS.md` — Agent 上下文索引（≤100 行）
- `.hx/config.yaml` — 项目级配置，支持字段：
  - `defaultProfile` — 默认团队 profile
  - `paths.requirementDoc` — 需求文档路径模板（默认 `docs/requirement/{feature}.md`）
  - `paths.planDoc` — 执行计划路径模板（默认 `docs/plans/{feature}.md`）
  - `paths.progressFile` — 进度追踪文件路径模板（默认 `docs/plans/{feature}-progress.json`）
  - `paths.taskDoc` — 任务执行文档路径模板（可选，如 `业务线/香港/需求/{feature}/任务/{taskId}/任务执行.md`）
  - `paths.src` — 源码目录（默认 `src`）
  - `paths.agents` — Agent 索引文件（默认 `AGENTS.md`）
- `~/.hx/config.yaml` — 用户全局配置（frameworkRoot、跨项目共享设置）
- `.hx/commands/` — 项目级命令覆盖（同名文件替换系统层命令）
- `~/.hx/commands/` — 用户级命令覆盖
- `.hx/profiles/` — 项目级自定义 profiles（最高优先级）
- `~/.hx/profiles/` — 用户全局自定义 profiles
- `.hx/pipelines/default.yaml` — 项目级流水线覆盖（自定义 `/hx-go` 执行顺序）
- `~/.hx/pipelines/default.yaml` — 用户全局流水线覆盖
- `~/.claude/commands/` — 转发器（hx setup 生成，运行时路由到实体命令）
- `docs/golden-principles.md` — 全局黄金原则 GP-001~GP-012
- `docs/map.md` — 架构全图
- `docs/requirement/` — 需求设计文档
- `docs/plans/` — 执行计划与进度 JSON
- `src/profiles/` — 框架内置 Profile 源文件（系统层）

## 执行规则

1. 每个 TASK 独立开会话执行，不在同一会话连续执行多个 TASK
2. 所有代码必须通过团队对应的门控检查
3. 错误使用 AppError 类，禁止裸 throw new Error
4. 禁止 console.log 进入 src/，使用结构化 logger
5. 执行前必须读取 `AGENTS.md` + `golden-principles.md` + 团队 `golden-rules.md`
6. Profile 配置优先级：全局 → 团队 → 平台（移动端额外一层）
7. Git commit 消息格式：`<type>: #<taskId>@<taskName>`，如 `feat: #TS-46474@新增巴士订单订单明细展示&契约对接`
