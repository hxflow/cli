# 执行需求

## 执行步骤

1. 执行 `bun scripts/tools/run.ts next <feature>`，读取当前批次任务。
2. 实现当前批次任务：
   - 脚本按依赖图计算批次，返回 `parallel: true` 时并行实现批次内所有 task，`parallel: false` 时顺序实现
3. 完成后通过 `bun scripts/lib/progress.ts` 回写状态，继续读取下一批并执行。
4. 重复直到 plan 中所有 task 全部完成。

## 下一步

- `hx check <feature>`

## 约束

- 必须一次性执行完 plan 中的所有 task，不能中途停下等待确认
- 仅当遇到明确阻断点（脚本返回 `blocked` 或任务本身标记需要人工确认）时才暂停，向用户说明阻断原因后等待输入
- 只处理脚本返回的 task、依赖和状态
