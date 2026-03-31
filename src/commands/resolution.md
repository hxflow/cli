# Command Resolution

- 这里定义命令解析与代理适配层的公共规则。

## 三层命令源

- 项目层：`<project>/.hx/commands/`
- 用户层：`~/.hx/commands/`
- 框架层：`src/commands/`

## 解析顺序

- 普通命令按以下顺序读取第一个存在的实体文件：
  1. 项目层
  2. 用户层
  3. 框架层
- 不做多层 merge，命中即停止。

## protected

- `protected: true` 的命令只允许读取框架层实体文件。
- 用户层和项目层都不能覆盖这类命令。

## 代理适配层

- `hx setup` 会根据这份规则生成：
  - `~/.claude/commands/*.md`
  - `~/.codex/skills/*/SKILL.md`
- 这些文件只负责把命令请求转发到最终命中的实体文件。
- 适配层不承载命令业务逻辑。

## 失败处理

- 三层都找不到命令实体文件时，直接报错。
- `protected` 命令若框架层文件缺失，也直接报错。
