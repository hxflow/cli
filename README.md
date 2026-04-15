# @hxflow/cli

Harness Workflow — Agent Skill for requirement-to-delivery pipeline.

## 简介

`hx` 是一个 Agent Skill，通过 `/hx <command>` 调用，组织需求到交付的全过程。

项目运行时事实：

- `.hx/config.yaml` — 项目配置
- `.hx/rules/*.md` — 项目规则
- `.hx/pipelines/` — 自定义流水线（可选）

## 安装

作为 Agent Skill 直接安装，无需 npm：

- **Claude Code**: 将本仓库添加为 skill
- **其他 Agent**: 按 Agent Skills 规范引用 `SKILL.md`

安装后在项目中执行 `/hx init` 初始化。

## 使用

```
/hx go feature-name        # 全自动流水线
/hx doc feature-name        # 获取需求
/hx plan feature-name       # 生成计划
/hx run feature-name        # 执行需求
/hx check feature-name      # 质量检查
/hx mr feature-name         # 创建 MR
```

## 命令

| 命令 | 阶段 | 说明 |
|------|------|------|
| `go` | 全流程 | 全自动流水线，串联 `doc → plan → run → check → mr` |
| `doc` | Phase 01 | 获取需求并创建需求文档 |
| `plan` | Phase 02 | 生成执行计划与 `progress.json` |
| `run` | Phase 04 | 执行需求任务 |
| `fix` | Fix | 修复错误 |
| `check` | Phase 06 | 质量检查（审查、质量门、工程卫生） |
| `mr` | Phase 08 | 创建 Merge Request |
| `init` | 初始化 | 生成 `.hx/config.yaml` 与 `.hx/rules/*.md` |
| `rules` | 规则 | 查看或更新项目规则 |
| `status` | 状态 | 查看任务进度 |

## 架构

```text
SKILL.md                    Skill 入口，路由到命令
src/commands/hx-*.md        命令定义
src/contracts/*.md          共享契约
src/tools/*.ts              事实工具脚本（AI 调用获取结构化数据）
src/pipelines/              默认流水线
src/templates/              模板文件
```

项目骨架：

```text
.hx/
  config.yaml
  rules/
    golden-rules.md
    review-checklist.md
    requirement-template.md
    plan-template.md
  pipelines/              (可选)
```

所有 `hx-*` 命令执行前先读取 `src/contracts/runtime-contract.md`，再进入对应命令正文。

## 环境要求

- Bun >= 1.0.0

## 测试

- 全量回归：`bun run hx:test`
- 单测：`bun run hx:test:unit`
- 集成：`bun run hx:test:integration`

## License

MIT
