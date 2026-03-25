# 全自动流水线 · 从需求到交付

参数: `$ARGUMENTS`（格式: `<feature-name> [--task <task-id>] --profile <team[:platform]>`）

## 当前目录约定

自动流水线在本项目中的事实来源已经统一为：

- `AGENTS.md`
- `.hx/config.json`
- `docs/requirement/<feature>.md`
- `docs/plans/<feature>.md`
- `docs/plans/<feature>-progress.json`
- 当前解析出的 Profile 资源（项目 `.hx/profiles/`、用户 `~/.hx/profiles/` 或框架内置）
