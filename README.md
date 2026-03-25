# Harness Workflow Framework

`@harness-workflow/cli` 的源码仓库。
它不是业务应用，而是一个 profile-driven 的工程交付框架：提供 `hx` CLI、内置 profile、文档模板、Claude 命令、Agent 工作流与质量门控。

## 仓库定位

这个仓库同时承担两类职责：

- 可发布的 CLI 包源码：`bin/hx.js` + `scripts/`
- 框架资产仓库：`docs/`、`src/profiles/`、`.claude/commands/`、`.claude/skills/`

安装到业务项目后，运行时会分成三层：

1. 用户全局层：`~/.hx/`、`~/.claude/`
2. 项目层：`<project>/.hx/`、`<project>/docs/`、`<project>/AGENTS.md`
3. 框架层：当前 npm 包内置的 `profiles/` 与脚本实现

## 快速开始

```bash
# 1. 全局安装 CLI
npm install -g @harness-workflow/cli

# 2. 首次初始化用户全局目录
hx setup

# 3. 在目标项目中启用框架
cd your-project
hx init --profile backend

# 4. 开始一个需求
hx doc user-login --profile backend
hx plan user-login --profile backend
hx run user-login TASK-BE-01 --profile backend
```

`hx setup` 会同步：

- `~/.hx/profiles/`：用户全局 profile 根目录
- `~/.hx/config.json`：用户全局配置
- `~/.claude/commands/`：`hx-*.md` 斜杠命令
- `~/.claude/skills/`：框架附带 skill

`hx init` 会在项目中创建或更新：

- `docs/requirement/`、`docs/plans/`
- `.hx/config.json`
- `AGENTS.md`
- `.CLAUDE.md -> AGENTS.md`
- `CLAUDE.md` 中的 harness 标记块
- `.claude/commands/`、`.claude/skills/`

## 配置与 Profile 解析

配置优先级从低到高：

`内置默认值` → `~/.hx/config.json` → `<project>/.hx/config.json`

profile 搜索顺序从高到低：

`<project>/.hx/profiles/` → `~/.hx/profiles/` → `<package>/profiles/`

profile 合并链：

- 通用基类：`base`
- 团队层：`backend` / `frontend` / `mobile`
- 平台层：`mobile:ios` / `mobile:android` / `mobile:harmony`

## 仓库结构

```text
.
├── bin/
│   └── hx.js                     # CLI 入口，负责命令分发与 version/help
├── scripts/
│   ├── hx-setup.js              # 用户全局安装：~/.hx + ~/.claude
│   ├── hx-init.js               # 项目初始化：docs/.hx/AGENTS/CLAUDE
│   ├── hx-upgrade.js            # 升级命令与 skills
│   ├── hx-uninstall.js          # 卸载框架痕迹
│   ├── hx-new-doc.js            # 创建需求文档
│   ├── hx-new-plan.js           # 生成计划与 progress JSON
│   ├── hx-agent-run.js          # 生成按 TASK 执行的 Agent Prompt
│   ├── hx-agent-fix.js          # 生成修复 Prompt
│   ├── hx-review-checklist.js   # 输出 review 清单
│   ├── hx-gate.js               # 执行 profile.gate_commands
│   ├── hx-check.js              # 串联 ctx + gate
│   ├── hx-ctx-check.js          # 校验文档与 profile 资源完整性
│   ├── hx-arch-test.js          # 按 profile 层级做导入合规检查
│   ├── hx-entropy-scan.js       # 扫描熵增模式
│   ├── hx-doc-freshness.js      # 文档新鲜度检查
│   ├── hx-task-done.js          # 标记任务完成
│   ├── hx-mr.js                 # 汇总 MR 创建上下文
│   ├── hx-install.js            # 仓库开发态安装器（Ink TUI）
│   ├── hx-install.cjs           # Node 版本引导入口
│   └── lib/                     # 共享基础库
├── docs/
│   ├── map.md                   # 框架与 profile 架构地图
│   ├── golden-principles.md     # 全局黄金原则
│   ├── quality-grades.md        # 当前模块质量评级
│   ├── requirement/             # 需求文档模板产物
│   └── plans/                   # 计划文档与 progress JSON
├── src/profiles/
│   ├── base/
│   ├── backend/
│   ├── frontend/
│   └── mobile/platforms/
├── .claude/commands/            # Claude 命令模板
├── .claude/skills/              # 附带 skill
├── tests/unit/                  # 核心库单测
├── tests/integration/           # CLI 集成测试
└── .agent/project-architecture.md
```

## 命令速查

### 安装与维护

| 命令                                                     | 说明                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `hx setup [--dry-run]`                                   | 同步用户全局目录中的 profiles、commands、skills                     |
| `hx init [--profile <team[:platform]>] [--target <dir>]` | 初始化项目目录                                                      |
| `hx upgrade [--target <dir>] [--dry-run]`                | 升级项目内 `.claude/commands/`、`.claude/skills/` 和 harness 标记块 |
| `hx uninstall [--target <dir>] [--yes] [--dry-run]`      | 移除项目内安装痕迹                                                  |
| `hx version`                                             | 显示 CLI 版本                                                       |

### 文档与计划

| 命令                                              | 说明                                  |
| ------------------------------------------------- | ------------------------------------- |
| `hx doc <feature> [--profile <team[:platform]>]`  | 创建需求文档                          |
| `hx plan <feature> [--profile <team[:platform]>]` | 生成计划文档与 `*-progress.json`      |
| `hx ctx [--profile <team[:platform]>]`            | 校验 AGENTS、需求、计划、profile 资源 |
| `hx done <task-id>`                               | 更新 progress 状态并提示下一个任务    |

### 执行与审查

| 命令                                                           | 说明                   |
| -------------------------------------------------------------- | ---------------------- |
| `hx run <feature> <task-id> [--profile <team[:platform]>]`     | 生成 Agent 执行 Prompt |
| `hx fix [--profile <team[:platform]>]`                         | 生成修复 Prompt        |
| `hx review [--profile <team[:platform]>]`                      | 输出 review 清单       |
| `hx gate [--profile <team[:platform]>]`                        | 执行门控命令           |
| `hx check [--profile <team[:platform]>]`                       | 先 ctx 后 gate         |
| `hx entropy [--profile <team[:platform]>]`                     | 扫描熵增模式           |
| `hx mr <feature> [--project <group/repo>] [--target <branch>]` | 输出 MR 创建上下文     |

## 框架内部主流程

### 1. CLI 分发

`bin/hx.js` 负责：

- 输出 help / version
- 将子命令映射到 `scripts/hx-*.js`
- 透传参数给目标脚本

### 2. 上下文解析

`scripts/lib/resolve-context.js` 负责：

- 识别项目根目录
- 合并用户级与项目级配置
- 给所有脚本提供 `projectRoot`、`requirementDir`、`plansDir`、`agentsPath`

### 3. Profile 解析

`scripts/lib/profile-utils.js` 负责：

- 解析 `backend` / `frontend` / `mobile:ios` 这类 profile specifier
- 读取 profile 继承链
- 解析模板变量与 requirement 中的层级勾选

### 4. 文档驱动执行

典型链路是：

`hx doc` → `hx plan` → `hx run` → `hx review` / `hx gate` → `hx done`

执行状态通过 `docs/plans/*-progress.json` 落盘，活跃特性会回写到 `AGENTS.md`。

## 架构规则

架构层级由 profile 决定：

- 后端：`Types → Config → Repo → Service → Runtime`
- 前端：`Types → Services → Stores → Hooks → Components → Pages`
- 移动端：`Domain → Data → Presentation → UI`

每一层只能导入 `profile.yaml` 中 `can_import` 允许的层，违规由 `hx gate` 与 `hx-arch-test.js` 负责检测。
详见 `docs/map.md` 与 `src/profiles/`。

## 开发与验证

```bash
# 查看 CLI 帮助
node bin/hx.js --help

# 单元测试
npm run hx:test:unit

# CLI 集成测试
npm run hx:test:integration

# 全量检查
npm run ci

# 校验最终打包内容
npm run pack:dry-run
```

## 自定义命令保护

如果项目对某些 Claude 命令做了本地修改，可以在 `.hx/config.json` 固定它们，避免 `hx upgrade` 覆盖：

```json
{
  "defaultProfile": "backend",
  "pinnedCommands": ["hx-run", "hx-review"]
}
```

也可以直接在 `.claude/commands/` 中新增 `hx-*.md` 文件，upgrade 不会碰这些非框架内置文件。

## 新成员 Onboarding

```bash
# 1. 安装 CLI 并全局初始化（只需一次）
npm install -g @harness-workflow/cli
hx setup

# 2. 在项目中初始化（如果项目已有 .hx/config.json 可跳过）
hx init --profile backend

# 3. 必读文档
cat AGENTS.md
cat docs/golden-principles.md
cat docs/map.md

# 4. 验证本地环境
hx check --profile backend
```

## 常见问题

**Q: `hx gate` 失败了怎么办？**
按顺序检查：① `npm run hx:lint:fix` 自动修复格式 → ② `npm run hx:type` 查看类型错误 → ③ `npm run hx:test:w` 调试测试

**Q: Agent 执行失败怎么办？**
先修复环境，再重开会话。检查：文档是否完整 → 类型定义是否准确 → `AGENTS.md` 与 `docs/plans/*-progress.json` 是否一致（`hx ctx`）

**Q: 想跳过 Git Hook 怎么办？**
`git commit --no-verify`，仅限紧急情况，且应在 PR 中说明原因。

**Q: 如何升级框架？**

```bash
npm update -g @harness-workflow/cli
hx upgrade --target /path/to/your-project
```
