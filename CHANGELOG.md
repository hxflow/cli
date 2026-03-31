# Changelog

## 3.0.0 - 2026-03-31

### Changed

- 主链路不再暴露 `taskId`，`hx-doc` 改为无参数入口。
- `feature` 改为基于需求详情生成的项目内稳定标识，优先中文，后续命令只续接不重算。
- `hx-doc`、`hx-plan`、`hx-run` 明确默认路径：
  - `docs/requirement/{feature}.md`
  - `docs/plans/{feature}.md`
  - `docs/plans/{feature}-progress.json`
- Hook 从覆盖规则改为中间件链：
  - `pre_*`: 框架层 -> 用户层 -> 项目层
  - `post_*`: 项目层 -> 用户层 -> 框架层
- Hook 公共规范收敛为固定输入输出接口：
  - 输入：`command`、`phase`、`projectRoot`、`feature`、`paths`、`gates`、`arguments`、`context`
  - 输出：`patch`、`warnings`、`abort`、`message`、`artifacts`
- 安装模型收敛为“一套 workflow skill，多 agent 安装”。
- 框架内部继续保留 `src/commands/`、`~/.hx/commands/`、`.hx/commands/`。
- agent 入口统一安装到各自的 `skills` 目录。
- forwarder 模板收敛为一套：
  - `src/templates/forwarders/skill-layered.md`
  - `src/templates/forwarders/skill-protected.md`
- `hx setup` 改为首次交互选择 agent，并将选择写入 `~/.hx/settings.yaml`。
- `hx setup` 后续默认复用 `~/.hx/settings.yaml` 中记录的 `agents`。
- 安装流程改为显式动作，移除自动 `postinstall`。
- README、guide、design 文档已统一到当前模型。

### Added

- 新增框架级 Hook：
  - `src/hooks/pre_doc.md`
  - `src/hooks/pre_fix.md`
- 新增仓库级 agent 协作说明：
  - `AGENTS.md`
- 新增重构总结文档：
  - `docs/design/hx-refactor-summary.md`

### Removed

- 移除 `src/scripts/hx-postinstall.js`
- 移除 package.json 中的 `postinstall`
- 移除 `tests/integration/hx-postinstall.test.js`
- 移除 agent `qwen`
- 移除旧模板：
  - `src/templates/forwarders/claude-layered.md`
  - `src/templates/forwarders/claude-protected.md`
  - `src/templates/forwarders/codex-layered.md`
  - `src/templates/forwarders/codex-protected.md`

### Supported Agents

- `claude`
- `codex`
- `cursor`
- `gemini`
- `kimi`
- `windsurf`

### Validation

- `npm run hx:test`
- `8` 个测试文件通过
- `31` 个测试通过

### Related Commits

- `b53a27d` `refactor: 收敛 skill 安装模型与 hook 规范`
- `3646fd9` `docs: 补充仓库 agent 协作说明`
