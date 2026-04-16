# 执行需求

## 执行步骤

1. 执行 `bun scripts/tools/run.ts next <feature>`，读取当前批次任务、依赖关系和运行态事实。
2. 只实现当前批次或显式指定的 task，完成后通过 `bun scripts/lib/progress.ts` 回写状态。
3. 根据脚本返回的下一批任务决定继续执行、恢复中断任务，或结束当前阶段。

## 下一步

- `hx check <feature>`

## 约束

- 未显式指定时只处理当前批次任务
- 优先恢复进行中的 task，再继续下一批
- 不自行扩展脚本未返回的任务依赖和状态
