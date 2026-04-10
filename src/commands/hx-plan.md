---
name: hx-plan
description: Phase 02 · 生成执行计划
usage: hx-plan [<feature>]
hooks:
  - pre
  - post
---

# Phase 02 · 生成执行计划

## 目标

把 `requirementDoc` 转成可执行的 `planDoc` 和 `progressFile`。

## 使用方式

```bash
hx plan <feature>
```

`hx plan` 会自动完成以下工作，并输出精确的生成指令：
- 定位需求文档，解析 feature 头部（固化解析）
- 根据 `Type` 字段选择计划模板（feature / bugfix）
- 输出 planDoc / progressFile 的目标路径、模板路径、schema 路径

## AI 职责：生成 planDoc 和 progressFile

收到 `hx plan` 的输出后：

1. 读取 requirementDoc 中的需求内容
2. 按 planTemplate 生成 planDoc，包含：目标、修改范围、实施要点、验收标准、验证方式
3. 从需求提取任务列表，按 progressTemplate/Schema 生成 progressFile
   - 每个 task：id, name, dependsOn[], parallelizable, output("")
   - 依赖关系和并行标记写入 progressFile，不写入 planDoc
4. 写入文件后运行：`hx progress validate <progressFile>`
5. 新开子 agent 评审任务拆分质量（粒度、依赖、可并行性）
6. 根据评审修正后，再次校验

**planDoc 质量标准：**
- 每个 task 只写目标、修改范围、实施要点、验收标准
- 不写依赖关系和并行标记
- 粒度：每个 task 独立可实现、可验证

## 约束

- feature 值固定，来自需求文档头部，不允许重算
- progressFile 必须通过 `hx progress validate` 才算完成

