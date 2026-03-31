# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 项目概述

`@hxflow/cli` 是一个 project-rules-driven 工程工作流框架，作为 npm 全局包发布，供 Claude Code 和 Codex 使用。运行时统一读取：

- `.hx/config.yaml`
- `.hx/rules/*.md`
- `.hx/hooks/`
- `.hx/commands/`
- `.hx/pipelines/`

## 常用命令

```bash
# 测试
pnpm vitest run                      # 运行所有测试
pnpm vitest run tests/unit/config-utils.test.js

# 打包（无构建步骤，直接使用源码）
npm run pack:dry-run
npm run release:pack

# 本地调试
node src/scripts/hx-postinstall.js
node bin/hx.js setup --dry-run
```

## 架构

### 三层覆盖体系

框架层 < 用户层 < 项目层，优先级由低到高：

```text
<frameworkRoot>/src/           # 框架内置（随 npm 包发布）
~/.hx/                         # 用户全局 commands/hooks/pipelines
<project>/.hx/                 # 项目 config/rules 与专属覆盖
```

### 核心模块

- `bin/hx.js`：CLI 入口，只路由 `setup/version`
- `src/scripts/hx-postinstall.js`：装包后自动补齐 `~/.hx/` 与 agent 适配层
- `src/scripts/hx-setup.js`：安装/修复 `~/.hx/` 与 agent 适配层
- `src/scripts/lib/config-utils.js`：参数解析与轻量 YAML 解析
- `src/scripts/lib/install-utils.js`：安装链与 agent 适配层文件操作工具
- `src/agents/commands/`：工作流命令的 Prompt 定义（`.md` 文件）
- `src/pipelines/default.yaml`：默认流水线定义（doc -> plan -> run -> qa -> mr）

### Agent 命令 Contract

所有工作流命令统一为 `hx-*`。Claude 使用 `/hx-*`，Codex 使用 `hx-*`。

## 发布

发布到内部私有 registry `https://npm.cdfsunrise.com/`。发布前用 `npm run pack:dry-run` 确认打包文件列表。

## 测试结构

- `tests/unit/`：对 `src/scripts/lib/` 的单元测试
- `tests/integration/`：对 `bin/hx.js` 的集成测试
