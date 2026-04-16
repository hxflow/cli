# @hxflow/cli 开发指南（Copilot 补充）

> 核心编码规范、测试要求、提交格式见 AGENTS.md（CLAUDE.md 为其软链）。本文件仅补充架构细节和开发工作流，避免重复。

## 架构概览

### Skill 优先级

1. **框架层** `hxflow/`（`commands/`、`scripts/`、`templates/`）→ 默认事实源
2. **项目层** `.hx/`（`config.yaml` + `rules/` + `pipelines/`）→ 仅承载项目配置、规则与可选 pipeline

### 契约系统

命令只读取明确引用的契约，不要预加载无关目录。

| 契约 | 职责 |
|------|------|
| feature-contract | `feature` 的复用优先和 AI 仍需遵守的语义边界 |

### 命令定义结构

`hxflow/commands/hx-*.md` 只保留：`执行步骤` → `下一步` → `约束`。其中 `执行步骤` 路由到对应脚本，`下一步` 才使用 `hx ...` 命令形式。

## 开发工作流

1. 编辑 `hxflow/commands/hx-*.md`
2. 有新逻辑则补 `tests/unit/` 单元测试；涉及文件 I/O 或命令链则补 `tests/integration/`
3. `npm run hx:test` 全量验证
4. `npm run pack:dry-run` 检查发包内容
5. Conventional Commits 提交
