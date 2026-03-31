# HXFlow 重构总结

## 背景

本轮重构围绕两个目标展开：

1. 收敛主链路语义，减少用户感知的内部参数。
2. 收敛安装与扩展模型，让 framework、agent、project 三层边界更清晰。

对应提交：

- `b53a27d` `refactor: 收敛 skill 安装模型与 hook 规范`
- `3646fd9` `docs: 补充仓库 agent 协作说明`

## 1. 主链路收敛

### 1.1 移除 taskId 作为主链路参数

主链路不再暴露外部系统 `taskId`。

- `hx-doc` 不再接收标题或任务号参数。
- 需求详情只来自当前上下文或外部系统。
- 外部系统编号仅作为来源元数据保留，不再作为主链路入参。

### 1.2 feature 语义重定义

`feature` 现在是项目内稳定需求标识。

- 只在 `hx-doc` 首次创建需求时生成。
- 基于需求详情总结生成，不从标题压缩推导。
- 优先中文，保持简短。
- 后续命令只续接，不重算。
- 冲突时追加 `-2`、`-3`。

### 1.3 默认路径明确化

命令契约中补齐了默认路径规则：

- `requirementDoc` -> `docs/requirement/{feature}.md`
- `planDoc` -> `docs/plans/{feature}.md`
- `progressFile` -> `docs/plans/{feature}-progress.json`

这让 `hx-doc`、`hx-plan`、`hx-run` 在缺省配置下也有稳定行为。

## 2. skill 安装模型收敛

### 2.1 内部保留 commands，外部统一 skill

这次重构明确区分了“内部组织形式”和“agent 安装形式”：

- 框架内置实体仍在 `src/commands/`
- 用户层和项目层覆盖仍在 `~/.hx/commands/`、`.hx/commands/`
- 各 agent 的入口统一安装到各自的 `skills` 目录

也就是：

- 内部仍是 `command contract`
- 外部统一以 `skill` 形式分发和运行

### 2.2 模板统一

原先针对不同 agent 的多套 forwarder 模板被收敛成一套：

- `src/templates/forwarders/skill-layered.md`
- `src/templates/forwarders/skill-protected.md`

不同 agent 的差异只保留在目标目录，不再保留模板分叉。

### 2.3 支持的 agent

当前保留的 agent：

- `claude`
- `codex`
- `cursor`
- `gemini`
- `kimi`
- `windsurf`

`qwen` 已移除。

## 3. setup 行为重构

### 3.1 交互选择 agent

`hx setup` 的安装行为改成：

- 首次执行时列出 agent 清单供用户选择
- 支持多选
- 直接回车表示全选
- 已有配置时默认复用历史选择

### 3.2 settings 持久化

用户选择的 agent 会记录到：

- `~/.hx/settings.yaml`

当前至少保存：

- `frameworkRoot`
- `agents`

后续修复、补装、升级默认复用这份选择。

### 3.3 去掉 postinstall 自动安装

安装链从“自动 postinstall”改成“手动执行 setup”。

- 删除 `src/scripts/hx-postinstall.js`
- 删除 package.json 中的 `postinstall`
- 文档统一改成：安装包后手动运行一次 `hx setup`

这样更符合显式安装原则，也避免 npm 安装阶段直接修改用户目录。

## 4. Hook 模型重构

### 4.1 从覆盖改为中间件链

Hook 不再是覆盖规则，而是固定顺序的中间件链：

- `pre_*`: 框架层 -> 用户层 -> 项目层
- `post_*`: 项目层 -> 用户层 -> 框架层

这让 Hook 更适合做“附加行为”和“业务定制”，而不是替代主命令。

### 4.2 公共输入输出规范

Hook 公共规范已收敛为抽象接口。

固定输入：

- `command`
- `phase`
- `projectRoot`
- `feature`
- `paths`
- `gates`
- `arguments`
- `context`

固定输出：

- `patch`
- `warnings`
- `abort`
- `message`
- `artifacts`

这层规范保持抽象，不绑定具体业务字段。

### 4.3 框架内置 hook 示例

新增了两个简洁的框架层 Hook：

- `src/hooks/pre_doc.md`
- `src/hooks/pre_fix.md`

其定位是：

- `pre_doc`：在 `hx-doc` 前获取企业 DevOps 需求详情
- `pre_fix`：在 `hx-fix` 前获取企业 DevOps 缺陷详情

它们只定义职责，不写死具体 skill、MCP 或字段实现。

## 5. 文档口径统一

本轮同步更新了 README、guide 和 design 文档，重点统一以下口径：

- 主链路不再由 `taskId` 驱动
- `feature` 基于需求详情生成
- 内部仍是 `commands`，外部安装为 `skills`
- `hx setup` 首次交互选择 agent，后续复用 `settings.yaml`
- 不再使用自动 `postinstall`
- Hook 采用中间件链模型

## 6. 测试收口

测试同步做了几类调整：

- 安装工具单测更新为通用 agent 列表与统一目录生成规则
- `hx-setup` 集成测试覆盖交互选择、settings 复用、dry-run 和新增 agent
- 删除 `hx-postinstall` 集成测试
- 文档一致性测试补充：
  - 不再公开强调 `--agent`
  - README 不再出现 `.hx/skills`
  - `hx-upgrade` 公开用法改为 `hx-upgrade [--dry-run]`

最新回归结果：

- `npm run hx:test`
- `8` 个测试文件
- `31` 个测试全部通过

## 7. 当前形态

重构完成后，框架可以概括为：

- 主链路以 `hx-doc -> hx-plan -> hx-run -> hx-qa -> hx-mr` 为核心
- `feature` 是项目内稳定需求标识
- Hook 是抽象扩展接口，按中间件链执行
- framework 内部以 `commands` 组织
- agent 外部以 `skills` 安装
- `hx setup` 负责 agent 选择与入口安装
- 安装是显式动作，不再依赖 `postinstall`

这是一次从“多套入口、多重语义、半隐式安装”向“单一 skill 分发、显式 setup、抽象 hook 接口”收敛的重构。
