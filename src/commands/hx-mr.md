---
name: hx-mr
description: Phase 08 · 创建 Merge Request
usage: hx-mr [<feature>] [--project <group/repo>] [--target <branch>]
hooks:
  - pre
  - post
---

# Phase 08 · 创建 Merge Request

## 目标

基于需求文档、进度状态和 git 事实生成 MR 标题与描述。

## 使用方式

```bash
hx mr <feature> [--target <branch>] [--project <group/repo>]
```

`hx mr` 会自动完成以下工作，并输出精确的生成指令：
- 定位 requirementDoc / progressFile（活跃或归档）
- 解析 feature 头部（固化解析）
- 收集 git log 和 diff --stat 事实
- 检测 target branch，输出所有事实供 AI 使用

## AI 职责：生成 MR 内容

收到 `hx mr` 的输出后：

1. 读取 requirementDoc（背景、目标、验收标准）
2. 读取 progressFile（任务完成状态与输出摘要）
3. 结合 git 事实，生成：
   - **MR 标题**（单行，清晰描述变更）
   - **MR 描述**（Markdown）：需求背景、变更说明、AC 验收清单、任务完成情况、测试说明
4. 输出 MR 标题和描述
5. 调用归档：`hx archive <feature>`

## 约束

- feature 只读取已有值，不允许在 MR 阶段生成或重算
- 归档路径固定：`docs/archive/{feature}/`，不允许自定义
- `hx archive` 会自动校验所有 task 均为 done，校验失败时返回未完成 task 列表
