# Phase 02 · 生成执行计划

参数: $ARGUMENTS（feature-name，与 docs/design/ 中对应文件同名）

## 执行步骤

1. 校验参数：未提供则提示用法 `/hx-plan user-login` 并停止
2. 读取 `harness-scaffold/docs/design/$ARGUMENTS.md`，如不存在则提示先运行 `/hx-doc`
3. 读取模板 `harness-scaffold/docs/plans/_template.md`
4. 分析设计文档中勾选的架构层级和 AC，自动生成任务拆分：
   - **后端任务**按架构层从内到外拆分：Types → Repo → Service → Runtime → 测试
   - **前端任务**按组件粒度拆分：组件 → Hook → 页面集成 → 测试
   - 每个 TASK 必须：有明确的输出文件路径、引用设计文档中的 AC、可独立测试
5. 生成两个文件：
   - `harness-scaffold/docs/plans/$ARGUMENTS.md`（人类可读的执行计划）
   - `harness-scaffold/docs/plans/$ARGUMENTS-progress.json`（机器可读的进度追踪）
6. 将新计划路径追加到 `harness-scaffold/AGENTS.md` 的「当前活跃特性」区块
7. 输出摘要：

```
✓ 执行计划已创建:
  docs/plans/$ARGUMENTS.md（X 个后端任务 + Y 个前端任务）
  docs/plans/$ARGUMENTS-progress.json
  AGENTS.md 已更新

下一步:
  /hx-ctx              # 校验上下文完整性
  /hx-run be TASK-BE-01  # 执行第一个后端任务
  /hx-run fe TASK-FE-01  # 执行第一个前端任务
```

## 拆分原则

- 每个 TASK 对应一个可测试产物（一个文件或一组紧密关联的文件）
- 后端总 TASK 数控制在 3~6 个，前端同理
- 依赖关系严格按架构层级排列：内层先于外层
- 每个 TASK 的 Prompt 模板预填在计划文件中，后续 `/hx-run` 直接使用
