# 标记任务完成

参数: `$ARGUMENTS`（task-id，如 `TASK-BE-03` 或 `TASK-IOS-01`）

## 当前实现

`hx:done` 会在 `docs/plans/*-progress.json` 中搜索对应任务并更新状态。

执行逻辑：

1. 校验 task-id 格式
2. 读取 `docs/plans/*-progress.json`
3. 找到目标任务后：
   - 若已完成，输出提示并停止
   - 否则写入 `status = done` 与 `completedAt`
4. 计算当前 feature 的完成进度
5. 若仍有待办任务，提示下一个 `pending` 任务与推荐命令
6. 若全部完成，提醒执行 `npm run hx:entropy`

## 输出示例

```text
✓ TASK-BE-03 已标记为完成
  特性: user-login  进度: 3/5

下一个任务: TASK-BE-04 — Controller 层
  npm run hx:run -- user-login TASK-BE-04 --profile backend
```
