# Phase 03 · 上下文完整性校验

参数: `$ARGUMENTS`（可选: `--profile <team[:platform]>`）

## 当前实现

`hx:ctx` 会基于项目根目录的当前约定进行检查：

- `AGENTS.md` 必须存在且不超过 100 行
- `AGENTS.md` 中所有 `→` 引用的文档路径必须存在
- `AGENTS.md` 中列出的活跃特性，其需求文档必须存在于 `docs/requirement/`
- 进度文件默认从 `docs/plans/*-progress.json` 读取
- `docs/golden-principles.md` 与 `docs/map.md` 必须存在且非空
- 若指定了 `--profile`，或项目的 `.hx/config.json` 配置了 `defaultProfile`，则额外检查对应 profile 资源是否完整

## Profile 解析顺序

1. `--profile`
2. `.hx/config.json` 中的 `defaultProfile`
3. 若仍未提供，则回退到 CLI 默认值

## 输出示例

```text
── 上下文校验 ──────────────────────────
✓ AGENTS.md: 48 行
✓ 文档引用: 12/12 个有效
✓ 进度文件: 2 个已检查
✓ 黄金原则: 存在
✓ 架构地图: 存在
✓ Profile: backend 完整

全部通过，可以开始执行。
```
