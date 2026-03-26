# 初始化项目

参数: `$ARGUMENTS`（可选: `--profile <name>`）

## 执行步骤

### Step 1: 分析项目结构

使用 Glob / Read / Grep 工具直接分析项目，收集：

- **技术栈**：`package.json`、`go.mod`、`pubspec.yaml`、`Podfile` 等依赖文件
- **源码目录**：`src/`、`app/`、`lib/` 等主要目录的层级与命名
- **门控命令**：`package.json` 中的 `scripts`（lint、test、typecheck、build）；Makefile、`go test` 等
- **文档结构**：是否存在 `docs/`、需求文档、执行计划等目录，记录实际路径模式
- **现有配置**：`.hx/config.yaml`（若存在，说明已初始化过）、`CLAUDE.md`、`AGENTS.md`

### Step 2: 推断 Profile

若 `$ARGUMENTS` 中指定了 `--profile <name>`，直接使用；否则按以下逻辑推断：

**推荐内置规范：**
- React / Vue / TypeScript + Vite/Next → `frontend`
- Go / Java / Python / Node 服务端 → `backend`
- React Native / Flutter → `mobile:android` 或 `mobile:ios`（按主平台）
- HarmonyOS → `mobile:harmony`

**推荐自定义规范（`extends: base`）：**
- 多语言混合项目
- 目录结构与所有内置 profile 差异明显
- 已有强烈的团队约定

### Step 3: 推断路径配置

根据 Step 1 的分析，推断各路径字段。**与默认值相同的字段无需写入配置。**

| 字段 | 默认值 | 检测方式 |
|------|--------|---------|
| `paths.src` | `src` | 实际源码主目录（`app/`、`lib/` 等非默认时写入） |
| `paths.agents` | `AGENTS.md` | 若存在 `.claude/AGENTS.md` 或其他路径则写入 |
| `paths.requirementDoc` | `docs/requirement/{feature}.md` | 查找已有需求文档的路径模式，提取 `{feature}` 占位符位置 |
| `paths.planDoc` | `docs/plans/{feature}.md` | 查找已有执行计划的路径模式 |
| `paths.progressFile` | `docs/plans/{feature}-progress.json` | 与 planDoc 同目录时无需写入 |
| `paths.taskDoc` | 无默认（可选） | 若存在按 feature/taskId 两级组织的任务文档目录则写入 |

**路径模式识别方法：**
- 用 Glob 查找已有文档（如 `docs/**/*.md`、`**/需求/**/*.md`）
- 若发现类似 `业务线/香港/需求/user-login/` 这样的结构，提取模板：`业务线/香港/需求/{feature}/`
- 若发现任务级文档（如 `.../任务/TASK-01/任务执行.md`），配置 `taskDoc`：`业务线/.../任务/{taskId}/任务执行.md`
- 若项目为空（无现有文档），路径全部使用默认值，不写入 `paths` 字段

### Step 4: 向用户输出推荐方案

展示以下内容，等待确认（或调整）：

- 推荐的 profile 名称及理由
- 检测到的门控命令（lint / test / type / build）
- 拟写入的 `paths` 字段（仅展示非默认值；若全为默认值则注明"使用默认路径"）
- 若推荐自定义 profile：列出拟写入的 `gate_commands` 和架构路径

### Step 5: 写入

确认后执行以下操作（直接用工具创建文件，目录会自动生成）：

**5a. 写入 `.hx/config.yaml`**（若已存在则只更新检测到的字段，不覆盖其他字段）：
```yaml
defaultProfile: <profile 名称>
# 仅写入与默认值不同的 paths 字段
paths:
  src: <非 src 时写入>
  agents: <非 AGENTS.md 时写入>
  requirementDoc: <非默认时写入>
  planDoc: <非默认时写入>
  progressFile: <非默认时写入>
  taskDoc: <检测到时写入>
```

**5b. 若需要自定义 profile**，写入 `.hx/profiles/<name>/profile.yaml`：
```yaml
extends: base
label: <团队名称>
gate_commands:
  lint: <检测到的 lint 命令>
  test: <检测到的 test 命令>
  type: <检测到的 typecheck 命令>
  build: <检测到的 build 命令>
```
（未检测到的命令省略）

**5c. 在 `CLAUDE.md` 中注入或更新 harness 标记块**

若 `CLAUDE.md` 不存在则创建；若已存在 `<!-- hxflow:start -->` 则替换块内内容。

标记块格式：
```
<!-- hxflow:start -->
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: `.hx/config.yaml`
- Profile: `<profile 名称>`
- 需求文档: `<requirementDoc 模板中的目录部分>`
- 执行计划: `<planDoc 模板中的目录部分>`
- Agent 索引: `<paths.agents 或 AGENTS.md>`

可用命令: `/hx-go` `/hx-doc` `/hx-plan` `/hx-run` `/hx-review` `/hx-gate` `/hx-entropy` `/hx-mr`

执行规则和上下文详见 `<paths.agents 或 AGENTS.md>`
<!-- hxflow:end -->
```

## 约束

- 分析阶段使用 Glob / Read / Grep 工具，不调用任何外部命令
- 写入阶段使用 Write / Edit 工具，不调用任何外部命令
- 若 `.hx/config.yaml` 已存在，只更新检测到的字段，不覆盖用户已有配置
- 与默认值相同的 `paths` 字段不写入配置，保持文件简洁
