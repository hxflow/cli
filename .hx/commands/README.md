# Project Commands

项目级命令实体放在这个目录，优先级高于 `~/.hx/commands/` 和框架层 `src/commands/`。

- 文件名必须是 `hx-*.md`
- 普通命令命中第一个存在的实体文件即停止，不做 merge
- `protected: true` 的框架命令不能在项目层覆盖
- 自定义命令正文结构需遵循 `src/contracts/command-contract.md`

可从 `hx-your-command.md.example` 复制开始。
