# Phase 05 · 修复 Review 意见

参数: $ARGUMENTS（可选，Review 意见的文本内容或 PR 编号）

## 执行步骤

### 1. 获取 Review 意见
- 如果 $ARGUMENTS 包含 PR 编号（纯数字），使用 `gh api repos/.../pulls/N/comments` 获取评论
- 如果 $ARGUMENTS 包含文本内容，直接解析为修复指令
- 如果无参数，询问用户粘贴 Review 意见

### 2. 加载上下文
读取：
1. `harness-scaffold/docs/golden-principles.md`
2. `harness-scaffold/docs/map.md`
3. 涉及文件的对应设计文档

### 3. 逐条修复
- 解析每条 Review 意见，定位到具体文件和行号
- 按照黄金原则和架构规则修复
- 不改变未被提及的代码
- 修复后不引入新的违规

### 4. 自验
- 运行 `/hx-gate` 的检查逻辑确认修复没有引入新问题
- 输出修复摘要

## 输出格式

```
── 修复 Review 意见 ──────────────────────
修复 1/3: src/service/authService.ts:47
  问题: 裸 throw new Error → 改为 AppError
  ✓ 已修复

修复 2/3: src/service/authService.ts:12
  问题: Service 层导入 Runtime 模块 → 移除，改用依赖注入
  ✓ 已修复

修复 3/3: docs/design/user-login.md
  问题: AC-003 锁定时长与代码不一致 → 更新文档为 10min
  ✓ 已修复

自验: lint ✓ | typecheck ✓ | test ✓
```
