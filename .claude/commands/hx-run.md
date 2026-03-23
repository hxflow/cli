# Phase 04 · Agent 执行任务

参数: $ARGUMENTS（格式: `<role> <task-id>`，如 `be TASK-BE-03` 或 `fe TASK-FE-01`）

## 执行步骤

### 0. 解析参数
- 从 $ARGUMENTS 中解析 role（fe/be）和 task-id（TASK-XX-NN）
- 未提供则提示用法：`/hx-run be TASK-BE-03`

### 1. 加载上下文（必须先读再做）
按顺序读取以下文件：
1. `harness-scaffold/AGENTS.md` — 获取当前活跃特性和执行规则
2. `harness-scaffold/docs/golden-principles.md` — 黄金原则
3. 找到 task-id 所属的执行计划文件（在 `docs/plans/*.md` 中搜索 task-id）
4. 读取执行计划关联的设计文档 `docs/design/xxx.md`
5. 读取进度 JSON，确认该 TASK 状态不是 `done`

### 2. 构建执行 Prompt
根据执行计划中该 TASK 的描述，构建高质量 Prompt：
- **引用 TASK-ID**：明确当前执行的是哪个任务
- **指定输出文件路径**：从计划中获取
- **引用类型定义**：使用 `src/types/` 中已有的类型，不自行推断
- **引用已有模块**：明确使用哪些 Repo/Service/Hook，禁止重复发明
- **引用 AC**：对照设计文档中的验收标准
- **引用黄金原则**：涉及的 GP-XXX 规则
- **约束边界**：不能做什么（架构层级限制、禁止跨层导入等）

### 3. 执行
按照构建的 Prompt 执行代码生成：
- 生成代码到指定路径
- 遵循架构层级约束
- 遵循黄金原则（GP-001 ~ GP-012）
- 使用 AppError 处理错误，使用结构化 logger

### 4. 自验
执行完成后自动运行：
- 检查生成的文件是否在正确的架构层级目录
- 检查是否有 `console.log`、`: any`、裸 `throw new Error`
- 如果 scaffold 中有 lint/test 配置，运行 `npm run hx:gate`

### 5. 更新进度
- 将进度 JSON 中该 TASK 的 status 改为 `done`，写入 completedAt
- 输出完成摘要

## 输出格式

```
── 执行 TASK-BE-03 ─────────────────────
📋 特性: user-login
📄 设计文档: docs/design/user-login.md
🎯 任务: Service 层 - 认证逻辑

[执行代码生成...]

✓ 文件已创建: src/service/authService.ts
✓ 黄金原则检查通过
✓ 进度已更新: TASK-BE-03 → done

下一个待执行任务: TASK-BE-04（Controller 层）
运行: /hx-run be TASK-BE-04
```

## 禁止事项
- 不在同一会话连续执行多个 TASK
- 不跳过上下文加载直接写代码
- 不自行发明类型/接口，必须引用已有定义
