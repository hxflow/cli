---
name: hx-uninstall
description: 卸载 Harness Workflow 安装痕迹
usage: hx-uninstall [--target <dir>] [--dry-run]
protected: true
---

# 卸载 Harness Workflow 安装痕迹

参数: `$ARGUMENTS`（可选: `[--target <dir>] [--dry-run]`）

## 执行步骤

1. 预览卸载范围：
   - 推导目标目录，默认当前项目根
   - 列出将删除的全局安装痕迹和项目内安装痕迹
   - 明确保留内容：`~/.hx/commands/`、`~/.hx/hooks/`、`~/.hx/pipelines/` 及用户自定义文件
2. 若未发现安装痕迹，直接说明“无需卸载”并结束。
3. 请求用户确认；未确认前不执行删除。
4. 用户确认后，逐项删除预览中的安装痕迹，并输出卸载结果。

## 失败处理

- `EACCES` / `permission denied`：提示用户手动删除或调整权限
- `ENOENT`：目标已不存在，可忽略并继续
- 若判断为框架问题，询问用户是否通过 `hx-issue` 提交 Bug

## 约束

- 必须先预览，再确认，再删除
- 不删除 `~/.hx/commands/`、`~/.hx/hooks/`、`~/.hx/pipelines/` 及其用户内容
