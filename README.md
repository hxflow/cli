# @hxflow/cli

Profile-driven AI engineering workflow framework for Claude Code. Zero-disruption installer for existing projects.

## 简介

`@hxflow/cli` 是面向团队工程师的 Claude Code 工作流框架，核心理念：**工程师不直接写业务代码，而是通过结构化文档 + Agent 执行的方式交付**。

支持后端、前端、移动端（iOS / Android / HarmonyOS）多团队 Profile，通过三层配置架构实现灵活定制。

## 安装

```bash
npm install -g @hxflow/cli --registry https://npm.cdfsunrise.com/
```

## 快速开始

```bash
# 1. 全局安装框架文件（首次使用必跑）
hx setup

# 2. 在项目目录中初始化（Claude Code 中执行）
/hx-init

# 3. 开始开发（Claude Code 中执行）
/hx-go <feature> --profile frontend
```

## CLI 命令

| 命令 | 用途 |
|------|------|
| `hx setup` | 全局安装，生成转发器到 `~/.claude/commands/`，初始化 `~/.hx/` |
| `hx upgrade [--dry-run]` | 升级系统层并同步自定义命令 |
| `hx uninstall [--yes]` | 移除全部安装痕迹 |
| `hx doctor` | 健康检测（环境、安装、项目配置） |
| `hx version` | 查看版本号 |

## 工作流命令（Claude Code 中使用）

### 一键自动化

| 命令 | 用途 |
|------|------|
| `/hx-go <feature> [--from <step>] --profile <team>` | 全自动流水线，Phase 01→08 |
| `/hx-run-all <feature> --profile <team>` | 批量执行所有 pending TASK |

### 单步命令

| 命令 | 阶段 | 用途 |
|------|------|------|
| `/hx-doc <feature> --profile <team>` | Phase 01 | 创建需求文档 |
| `/hx-plan <feature> --profile <team>` | Phase 02 | 生成执行计划 |
| `/hx-ctx [--profile <team>]` | Phase 03 | 校验上下文完整性 |
| `/hx-run <feature> <task-id> --profile <team>` | Phase 04 | 执行单个 TASK |
| `/hx-review [--profile <team>]` | Phase 05 | 代码审查 |
| `/hx-gate [--profile <team>]` | Phase 06 | 运行门控检查 |
| `/hx-fix [--profile <team>]` | Phase 05 | 修复 Review 意见 |
| `/hx-entropy [--profile <team>]` | Phase 07 | 熵扫描 |
| `/hx-mr <feature>` | Phase 08 | 输出 MR 创建上下文 |
| `/hx-done <task-id>` | 收尾 | 标记任务完成 |

## Profile 系统

所有命令支持 `--profile` 参数指定团队配置：

```bash
--profile backend          # 服务端
--profile frontend         # 前端
--profile mobile:ios       # 移动端 iOS
--profile mobile:android   # 移动端 Android
--profile mobile:harmony   # 移动端 HarmonyOS
```

## 三层架构

```
系统层  <frameworkRoot>/src/agents/   命令实体、profiles（git pull 升级）
用户层  ~/.hx/                        用户自定义覆盖（跨项目共享）
项目层  <project>/.hx/               项目专属覆盖（最高优先级）
```

每层结构一致：`commands/`、`profiles/`、`skills/`、`pipelines/`、`config.yaml`

## 自定义工作流命令

在项目 `.hx/commands/<name>.md` 中编写 Claude 指令，运行 `hx upgrade` 后即可在 Claude Code 中使用 `/<name>`。同名文件自动覆盖框架内置命令。

## 环境要求

- Node.js >= 18.0.0
- Claude Code CLI

## License

MIT
