---
name: hx-check
description: 核心检查入口
usage: hx-check [--scope <review|qa|clean|all>]
hooks:
  - pre
  - post
---

# 核心检查入口

## 目标

实现完成后，执行审查、质量门和工程卫生扫描。

## 使用方式

```bash
hx check [--scope <review|qa|clean|all>]
```

`hx check` 会自动完成以下工作，并输出精确检查指令：
- 读取 `.hx/config.yaml` 中配置的 gate 命令
- 定位 review-checklist.md 和 golden-rules.md
- 输出每个 scope 的执行步骤和通过标准

## AI 职责

**review scope：** 对照 review-checklist.md 执行审查，区分 blocker / warning / suggestion

**qa scope：** 按顺序执行输出中列出的 gate 命令（exit code 0 = 通过）

**clean scope：** 扫描调试代码、dead code、文档一致性问题（只报告，不修改）

## 约束

- qa 只看 exit code，不看命令输出文本
- clean 只做扫描和报告，不修改任何文件
- 存在 blocker 时输出具体修复建议，运行 `hx fix <feature>` 或人工修复后重试

