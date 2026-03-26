# Phase 03 · 上下文完整性校验

参数: `$ARGUMENTS`（可选: `--profile <team[:platform]>`）

## 执行步骤

1. 解析 Profile（可选）：优先 `--profile`，否则读 `.hx/config.yaml` 的 `defaultProfile`
2. 解析路径：读取 `.hx/config.yaml`（项目层）和 `~/.hx/config.yaml`（用户层）合并后的 `paths` 字段：

   | 字段 | 默认值 |
   |------|--------|
   | `paths.requirementDoc` | `docs/requirement/{feature}.md` |
   | `paths.progressFile` | `docs/plans/{feature}-progress.json` |

3. 检查 `AGENTS.md`（或 `paths.agents`）：
   - 必须存在
   - 行数 ≤ 100
   - 所有 `→` 引用的文件路径必须存在
4. 检查活跃特性的需求文档：
   - 读取 AGENTS.md 中列出的活跃特性
   - 每个特性按 `requirementDoc` 模板解析路径，路径必须存在
5. 检查进度文件：
   - 按 `progressFile` 模板匹配的文件是否可解析
5. 检查基础文档：
   - `docs/golden-principles.md` 必须存在且非空
   - `docs/map.md` 必须存在且非空
6. 如果指定了 profile：
   - 找到 profile.yaml 并验证可读取
   - `gate_commands` 中至少有一个非空命令
   - 继承的 profile（`extends:`）也完整

## 输出格式

```
── 上下文校验 ──────────────────────────────
  ✓ AGENTS.md: XX 行
  ✓ 文档引用: N/N 个有效
  ✓ 进度文件: N 个已检查
  ✓ 黄金原则: 存在
  ✓ 架构地图: 存在
  ✓ Profile: <name> 完整
```

任何检查失败时，列出具体问题并停止，不输出"可以开始执行"。
