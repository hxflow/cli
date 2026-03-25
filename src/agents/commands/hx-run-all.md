# 批量执行所有待完成任务

参数: `$ARGUMENTS`（格式: `<feature-name> [--profile <team[:platform]>]`）

## 文档约定

批量执行前，默认读取：

- `docs/plans/<feature>-progress.json`
- `docs/plans/<feature>.md`
- `docs/requirement/<feature>.md`
- `AGENTS.md`
- `docs/golden-principles.md`
- 当前 Profile 对应的 `golden-rules.md`
