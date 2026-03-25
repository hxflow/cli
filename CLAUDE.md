# Harness Engineering — Claude Code 项目配置

## 项目概述

本项目是 Harness Engineering 需求开发规范的 workflow framework，包含规范文档、Profile 系统和流程命令。
核心理念：工程师不直接写业务代码，而是通过结构化文档 + Agent 执行的方式交付。

## 架构层级

架构因团队而异，通过 Profile 系统定义：
- **后端**: Types → Config → Repo → Service → Runtime
- **前端**: Types → API Services → Stores → Hooks → Components → Pages
- **移动端**: Domain → Data → Presentation → UI（Clean Architecture）

每一层只能导入内层，违反由 CI 自动阻断。

## Profile 系统

所有命令支持 `--profile` 参数指定团队配置：
```
--profile backend           # 服务端
--profile frontend          # 前端
--profile mobile:ios        # 移动端 iOS
--profile mobile:android    # 移动端 Android
--profile mobile:harmony    # 移动端 HarmonyOS
```

Profile 解析顺序为项目 `.hx/profiles/` → 用户 `~/.hx/profiles/` → 框架内置 `profiles/`。

## 安装与维护

通过 `hx` CLI 管理框架的安装、升级和卸载：

| 命令 | 用途 |
|------|------|
| `hx setup` | **首次安装**：将 profiles 和命令文件安装到 `~/.hx/` 和 `~/.claude/` |
| `hx init [--profile <team>]` | 初始化项目：创建文档目录、写入 `.hx/config.json` |
| `hx upgrade [--dry-run]` | 升级 `.claude/commands/`、`.claude/skills/` 和 CLAUDE.md 标记块 |
| `hx uninstall [--yes]` | 移除安装痕迹（配置文件、命令文件、标记块） |

**配置优先级（低 → 高）：** 内置默认值 → `~/.hx/config.json` → `<project>/.hx/config.json`

**Profile 查找顺序：** `<project>/.hx/profiles/` → `~/.hx/profiles/` → 框架内置 `profiles/`

如需保留对某个命令的本地修改，在 `.hx/config.json` 中添加 `pinnedCommands`：
```json
{ "pinnedCommands": ["hx-run"] }
```

## 工作流命令

### 一键自动化（推荐）

| 命令 | 用途 |
|------|------|
| `/hx-go <feature> [--task <id>] --profile <team>` | **全自动流水线**：Phase 01→08 一条龙，4 个人工检查点 |
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
- `.hx/config.json` — 项目级配置（默认 profile、路径覆盖、pinnedCommands）
- `~/.hx/config.json` — 用户全局配置（跨项目共享）
- `~/.hx/profiles/` — 用户全局自定义 profiles
- `.hx/profiles/` — 项目级自定义 profiles（最高优先级）
- `docs/golden-principles.md` — 全局黄金原则 GP-001~GP-012
- `docs/map.md` — 架构全图
- `docs/requirement/` — 需求设计文档
- `docs/plans/` — 执行计划与进度 JSON
- `src/profiles/` — 本仓库中的框架内置 Profile 源文件

## 执行规则

1. 每个 TASK 独立开会话执行，不在同一会话连续执行多个 TASK
2. 所有代码必须通过团队对应的门控检查
3. 错误使用 AppError 类，禁止裸 throw new Error
4. 禁止 console.log 进入 src/，使用结构化 logger
5. 执行前必须读取 `AGENTS.md` + `golden-principles.md` + 团队 `golden-rules.md`
6. Profile 配置优先级：全局 → 团队 → 平台（移动端额外一层）
7. Git commit 消息格式：`<type>: #<taskId>@<taskName>`，如 `feat: #TS-46474@新增巴士订单订单明细展示&契约对接`
