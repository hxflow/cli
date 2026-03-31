---
name: hx-init
description: 初始化项目规则事实
usage: hx-init
protected: true
---

# 初始化项目规则事实

参数: `$ARGUMENTS`（本命令不接受额外参数）

## 执行步骤

1. 确定项目根：
   - 优先使用当前工作目录中已存在的 `.hx/config.yaml`
   - 若不存在，则向上查找 `.git`
   - 若两者都不存在，明确告知用户当前目录无法判定为项目根，停止写入
2. 分析项目真实信号，归纳项目事实：
   - 依赖与构建入口，如 `package.json`、锁文件、`tsconfig.json`、`go.mod`、`Cargo.toml`、`pubspec.yaml`
   - 常见源码目录，如 `src/`、`app/`、`lib/`、`server/`、`client/`、`cmd/`、`internal/`、`pkg/`
   - 现有 `docs/**/*.md`、`.hx/` 和 lint / test / type / build 命令定义
3. 基于 `src/templates/config.yaml` 生成或补全 `.hx/config.yaml`。
4. 基于 `src/templates/rules/*` 生成或更新：
   - `.hx/rules/golden-rules.md`
   - `.hx/rules/review-checklist.md`
   - `.hx/rules/requirement-template.md`
   - `.hx/rules/plan-template.md`
5. 初始化或补全项目骨架，并更新 `CLAUDE.md` / `AGENTS.md` 标记块：
   - `.hx/commands/README.md`
   - `.hx/commands/hx-your-command.md.example`
   - `.hx/hooks/README.md`
   - `.hx/hooks/pre_run.md.example`
   - `.hx/hooks/post_run.md.example`
   - `.hx/pipelines/default.yaml`

## 约束

- 只根据真实文件、目录和命令定义归纳项目事实
- 不虚构技术栈、目录、脚本或架构结论
- 已有配置和人工内容优先保留，只补全缺失部分
- 配置和规则内容以模板文件为准，不在本命令正文内维护骨架
- 只初始化项目骨架，不负责后续执行、校验或修复
