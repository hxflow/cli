# 质量门控

参数: `$ARGUMENTS`（可选: `--profile <team[:platform]>`）

## 当前实现

`hx:gate` 会从 profile 的 `gate_commands` 中读取门控命令，并按固定顺序执行：

1. `lint`
2. `build`
3. `type`
4. `test`
5. `arch`

特点：

- 命令在项目根目录执行
- 仅执行 profile 中已定义的步骤
- 任一步骤失败即停止
- 若命令仍包含未替换占位符（如 `{scheme}`），直接报错并提示补参数

## 输出示例

```text
── 质量门控 ──────────────────────────
质量门控 · 前端
→ Step 1/4  lint   ✓ lint 通过
→ Step 2/4  type   ✓ type 通过
→ Step 3/4  test   ✓ test 通过
→ Step 4/4  arch   ✓ arch 通过

✓ frontend 门控全部通过
```
