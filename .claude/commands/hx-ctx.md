# Phase 03 · 上下文完整性校验

无需参数，自动扫描当前仓库状态。

## 检查项（全部通过才算合格）

### 1. AGENTS.md 健康检查
- 读取 `harness-scaffold/AGENTS.md`
- 行数 ≤ 100 行，超出则报错并建议精简
- 所有 `→` 引用的文档路径必须实际存在，逐个检查

### 2. 活跃特性完整性
- 读取 AGENTS.md 中「当前活跃特性」列出的所有计划文件
- 每个计划文件对应的设计文档 `docs/design/xxx.md` 必须存在
- 设计文档中的 AC 不为空

### 3. 进度文件一致性
- 扫描 `harness-scaffold/docs/plans/*-progress.json`
- 检查每个 JSON 中 `designDoc` 指向的文件是否存在
- 检查是否有状态为 `in-progress` 但计划文件中描述缺失的 TASK

### 4. 黄金原则可达
- `harness-scaffold/docs/golden-principles.md` 必须存在且非空
- `harness-scaffold/docs/map.md` 必须存在且非空

## 输出格式

```
── 上下文校验 ──────────────────────────
✓ AGENTS.md: XX 行（≤100）
✓ 文档引用: X/X 个有效
✓ 活跃特性: [feature-a]（3/5 TASK 完成）, [feature-b]（进行中）
✓ 黄金原则: 存在（GP-001 ~ GP-0XX）
✓ 架构地图: 存在

全部通过，可以开始 Agent 执行。
```

或者：

```
✗ AGENTS.md 引用不存在: docs/design/xxx.md
✗ feature-a 的设计文档 AC 为空
⚠ AGENTS.md 超过 100 行（当前 112 行）

请修复以上问题后再启动 Agent 执行。
```
