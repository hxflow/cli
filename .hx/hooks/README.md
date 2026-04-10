# Project Hooks

项目级 Hook 按固定命名装配，不在 `.hx/config.yaml` 中声明。

- 文件名使用 `pre_<command>.md` / `post_<command>.md`
- 只有命令 frontmatter 声明了 `hooks`，对应 Hook 才会生效
- `pre_*` 顺序：框架层 -> 用户层 -> 项目层
- `post_*` 顺序：项目层 -> 用户层 -> 框架层

可从 `pre_run.md.example` 和 `post_run.md.example` 复制后改名启用。
