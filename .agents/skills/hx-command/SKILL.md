---
name: hx-command
description: |
  编写或修改 hx-* 命令契约。
  当用户要求"新增 hx-xxx 命令"、"修改 hx-xxx"、"审查命令契约"时使用。
  所有对 hxflow/commands/hx-*.md 的新增和修改都必须走本 Skill。
---

# 编写或修改 hx-* 命令契约

## 前置条件

1. 读取 `hxflow/commands/` 下 2-3 个现有命令，对齐风格和粒度
2. 读取 `tests/unit/command-contracts.test.ts`，了解测试会验证什么

## 命令契约结构

### 正文章节（固定顺序，全部必选）

```
# <标题>
## 执行步骤
## 下一步
## 约束
```

## 写作原则

- 命令正文只描述 AI 要做什么，不描述代码已经知道什么
- `执行步骤` 使用对应脚本路由；`下一步` 使用用户态命令：`hx <command> ...`
- 短句、动词开头、可执行表述
- 单个要点只表达一个约束
- 能用 3 条说清的不扩成 8 条
- 只有 AI 仍可能做错的语义边界才保留在正文；确定性事实下沉到脚本、schema、template 和测试

## 执行步骤

### 新增命令

1. 按上述结构创建 `hxflow/commands/hx-<name>.md`
2. 更新 `tests/unit/command-contracts.test.ts` 中的 `ALL_COMMANDS` 列表
3. 运行 `bun test tests/unit/command-contracts.test.ts`

### 修改命令

1. 读取目标命令文件
2. 按用户要求修改，保持正文极简结构
3. 运行 `bun test tests/unit/command-contracts.test.ts`

### 审查命令

1. 对比规范检查：章节完整性、是否使用 `hx ...`、是否重复脚本已固化事实
2. 输出不符合项和改进建议

## 约束

- 不改动用户未提及的其他命令
- 不在命令正文重复参数模型、状态流、schema、路径模板或脚本返回字段
