# 全自动流水线 · 从需求到交付

## 执行步骤

1. 执行 `bun scripts/tools/go.ts next <feature>` 或 `bun scripts/tools/go.ts state <feature>`；若无 bun 则执行 `npx tsx scripts/tools/go.ts next <feature>` 或 `npx tsx scripts/tools/go.ts state <feature>`，读取当前已注册流水线的下一步、完整状态和 `preHooks`。
2. 先读取 `preHooks`，再按返回的 `toolScript` 路由到对应脚本。
3. 遇到 `checkpoint.message` 时新开一个子 agent 评审，并按结论继续或重跑当前 step。
4. 重复直到流水线完成、被阻塞或显式停止。

## 约束

- 自动恢复不得跳过最早未完成 step
- `--from <step>` 必须是有效 step 名称
- 默认读取 `.hx/config.yaml` 中注册的 `default` 流水线
- 下一步、完整状态和 `preHooks` 统一以运行时返回事实为准
