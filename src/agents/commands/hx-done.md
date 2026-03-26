# 标记任务完成

参数: `$ARGUMENTS`（task-id，格式 `TASK-<TEAM>-<NN>`，如 `TASK-BE-03`）

## 执行步骤

1. 解析 task-id，验证格式（`TASK-[A-Z]+-[0-9]+`）
2. 解析路径：读取 `.hx/config.yaml` 合并配置，取 `paths.progressFile`（默认 `docs/plans/{feature}-progress.json`）
3. 按 `progressFile` 模板扫描匹配的进度文件，找到包含该 task-id 的文件
4. 检查任务当前状态：
   - 若已是 `done`：输出提示并停止
   - 若是 `pending` / `in_progress`：继续
5. 更新进度文件：设置 `status = "done"`，写入 `completedAt`（ISO 8601）
6. 计算当前 feature 的完成进度（done 任务数 / 总任务数）
7. 输出结果：
   - 若还有 `pending` 任务：列出下一个任务 ID 和名称，提示 `/hx-run <feature> <next-task-id>`
   - 若全部完成：提示运行 `/hx-entropy` 进行熵扫描

## 输出格式

```
✓ TASK-BE-03 已标记为完成
  特性: user-login  进度: 3/5

下一个任务: TASK-BE-04 — Controller 层
  /hx-run user-login TASK-BE-04 --profile backend
```
