# Phase 07 · 熵扫描报告

参数: `$ARGUMENTS`（可选: `--profile <team[:platform]>`）

## 当前实现

`hx:entropy` 主要做静态模式扫描，默认关注 `src/` 下的 TypeScript 文件，并排除测试文件。

当前内置扫描包括：

- `console.log / warn / error / debug / info`
- `throw new Error(...)`
- `: any`
- 可疑的类型断言
- 空 `catch`
- `TODO / FIXME / HACK / XXX`
- 魔法数字
- 未处理的 `new Promise`

相关文档检查使用：

- `docs/requirement/*.md`
- `docs/plans/*-progress.json`
- `AGENTS.md`

## Hook 注入

在执行熵扫描前后，检查以下 hook 文件（存在则读取内容并注入）：

**前置 Hook（pre）**——注入额外扫描规则或忽略模式：
- `~/.hx/hooks/entropy-pre.md`（用户全局）
- `.hx/hooks/entropy-pre.md`（项目级）

**后置 Hook（post）**——扫描完成后执行额外指令（如生成报告、通知等）：
- `~/.hx/hooks/entropy-post.md`（用户全局）
- `.hx/hooks/entropy-post.md`（项目级）

也可在 `.hx/config.json` 的 `hooks.entropy.pre` / `hooks.entropy.post` 数组中声明额外路径。

## 输出示例

```text
熵扫描报告 — 2026/3/24
扫描文件数: 12，发现问题: 4 处
```
