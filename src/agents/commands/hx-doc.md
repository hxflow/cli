# Phase 01 · 创建需求文档

参数: `$ARGUMENTS`（格式: `<feature-name> [--task <task-id>] [--profile <team[:platform]>]`）

## 当前实现

`hx:doc` 是一个基于 profile 模板的文档生成命令，不会自动调用 DevOps。

执行逻辑：

1. 解析 `feature-name`，要求为 kebab-case
2. 解析 profile：
   - 优先 `--profile`
   - 否则读取 `.hx/config.json` 中的 `defaultProfile`
   - 仍无则回退到 CLI 默认值
3. 加载当前 Profile 对应的 `requirement-template.md`
4. 在 `docs/requirement/<feature-name>.md` 生成文档
5. 自动写入日期、团队/平台信息
6. 如果传入 `--task`，在文档头部补充 `来源任务：DevOps #<task-id>`

## Hook 注入

在生成需求文档前后，检查以下 hook 文件（存在则读取内容并注入）：

**前置 Hook（pre）**——在文档生成前读取，作为额外上下文或约束：
- `~/.hx/hooks/doc-pre.md`（用户全局）
- `.hx/hooks/doc-pre.md`（项目级）

**后置 Hook（post）**——文档生成完成后执行额外指令：
- `~/.hx/hooks/doc-post.md`（用户全局）
- `.hx/hooks/doc-post.md`（项目级）

也可在 `.hx/config.json` 的 `hooks.doc.pre` / `hooks.doc.post` 数组中声明额外路径。

## 输出示例

```text
✓ 需求文档已创建: docs/requirement/user-login.md
  团队: 服务端
  来源任务: DevOps #12345

下一步: hx plan user-login --profile backend
```
