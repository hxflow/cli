---
name: hx-issue
description: 向框架仓库提交 Bug Issue
usage: hx-issue [--title <title>] [--body <text>] [--no-ai]
protected: true
---

# 向框架仓库提交 Bug Issue

参数: `$ARGUMENTS`（格式: `[--title <title>] [--body <text>] [--no-ai]`）

## 执行步骤

1. 解析参数：
   - `--title <title>`
   - `--body <text>`
   - `--no-ai`
2. 若参数不足，向用户补充收集：
   - Bug 描述
   - 复现步骤
   - 相关文件、命令或错误信息
3. 生成结构化 issue 内容：
   - 标题格式：`bug: {简洁描述}`
   - 正文包含问题描述、期望行为、实际行为、复现步骤、相关信息
4. 调用 GitLab API 创建 issue：
   - 目标仓库：`frontend/qybot/qiyuan-harness-guide`
   - 从环境变量 `$GITLAB_TOKEN` 读取 token
   - 未传入 `--no-ai` 时附加 `ai-fix` label
5. 输出 issue 编号和链接。

## 失败处理

- `$GITLAB_TOKEN` 缺失：提示用户先配置环境变量
- API 创建失败：输出错误信息，不自动重试

## 约束

- 不修改 issue 之外的任何仓库内容
- 不自动重试失败请求
