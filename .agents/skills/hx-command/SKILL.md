---
name: hx-command
description: |
  编写或修改 hx-* 命令契约。
  当用户要求"新增 hx-xxx 命令"、"修改 hx-xxx"、"审查命令契约"时使用。
  所有对 src/commands/hx-*.md 的新增和修改都必须走本 Skill。
---

# 编写或修改 hx-* 命令契约

## 前置条件

1. 读取 `src/contracts/command-contract.md`，了解完整契约规范
2. 读取 `src/commands/` 下 2-3 个现有命令，对齐风格和粒度
3. 读取 `tests/unit/command-contracts.test.js`，了解测试会验证什么

## 命令契约结构

### Frontmatter

```yaml
---
name: hx-<name>
description: <一句话，20 字以内>
usage: hx-<name> [参数]
protected: true        # 可选
hooks:                 # 可选，只允许 [pre, post]
  - pre
  - post
---
```

### 正文章节（固定顺序，全部必选）

```
# <标题>
## 目标
## 何时使用
## 输入
  - 命令参数：`$ARGUMENTS`
  - 必选参数：
  - 可选参数：
  - 默认值：
  - 依赖输入：
## 执行步骤
## 成功结果
## 失败边界
## 下一步
## 约束
```

## 写作原则

- 先目标，再边界，最后约束
- 短句、动词开头、可执行表述
- 单个要点只表达一个约束
- 能用 3 条说清的不扩成 8 条
- 引用 contract/rules 只写路径，不内联内容
- 涉及详细设计细节（schema、状态机、数据结构等）时，独立为 contract 或文档文件，命令正文只引用路径

## 执行步骤

### 新增命令

1. 按上述结构创建 `src/commands/hx-<name>.md`
2. 更新 `tests/unit/command-contracts.test.js` 中的 `ALL_COMMANDS` 列表
3. 若命令为 protected，更新 `PROTECTED_COMMANDS`
4. 若命令声明了 hooks，更新 `HOOKED_COMMANDS`
5. 运行 `npx vitest run tests/unit/command-contracts.test.js`

### 修改命令

1. 读取目标命令文件
2. 按用户要求修改，保持章节结构完整
3. 运行 `npx vitest run tests/unit/command-contracts.test.js`

### 审查命令

1. 对比规范检查：frontmatter 字段、章节完整性、写作风格
2. 输出不符合项和改进建议

## 约束

- 不改动 `src/contracts/` 下的契约文件
- 不改动用户未提及的其他命令
- `protected: true` 的命令只能由框架层定义
