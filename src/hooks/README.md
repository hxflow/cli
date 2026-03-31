# Framework Hooks

- 这里是框架层 Hook 目录，也是 Hook 解析规则的公共约定。
- 命令是否支持 Hook，以及 `hooks` 字段的取值规则，见 `src/commands/README.md`。
- Hook 统一采用 `pre_<command>.md` / `post_<command>.md` 命名。
- 以 `hx-run` 为例，文件名为：
  - `pre_run.md`
  - `post_run.md`
- 查找顺序固定为：
  - 项目层 `.hx/hooks/`
  - 用户层 `~/.hx/hooks/`
  - 框架层 `src/hooks/`
- 解析时先读取命令 frontmatter 中的 `hooks`，再决定是否查找 `pre_<command>.md` 和 `post_<command>.md`。
- 某一层不存在对应文件时直接跳过，不报错。
