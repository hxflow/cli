<!-- hx:auto:start -->
# Golden Rules

## 项目事实

- 技术栈: {{projectFacts.techStack}}
- 包管理器: {{projectFacts.packageManager}}
- 主源码目录: {{projectFacts.srcPath}}
- 文档目录: {{projectFacts.docsPath}}
- 质量门: {{projectFacts.gatesSummary}}
- 待人工确认: {{projectFacts.pendingItems}}

## 实现边界

- 只基于当前项目中真实存在的文件、目录、脚本和配置做判断。
- 不虚构未落地的模块、命令、服务、目录或工程约定。
- 当事实不足时，先写保守结论，并明确标记“待人工确认”。

## 架构与目录约束

- 主要代码应落在 `{{projectFacts.srcPath}}` 及其现有子目录内。
- 新增文件优先对齐项目既有目录分层，不强行引入新的抽象层。
- 若需跨模块改动，先保持边界清晰，再考虑复用和收敛。

## 错误处理原则

- 优先复用现有错误处理模式、返回结构和日志方式。
- 不吞错，不用空 `catch`，不引入无法解释的兜底逻辑。
- 新增异常分支时，要给出可定位的上下文信息。

## 测试与验证要求

- 优先执行项目已存在的质量门：{{projectFacts.gatesSummary}}。
- 若无法运行某项验证，需要明确说明原因和影响范围。
- 涉及行为变化时，至少补充对应层级的验证步骤或测试。

## 变更约束

- 修改范围优先控制在当前需求相关文件内。
- 不顺手重构无关模块，不覆盖用户已有人工规则内容。
- 生成内容只更新自动区，人工区长期保留。
<!-- hx:auto:end -->

<!-- hx:manual:start -->
<!-- 团队可在这里补充长期有效的项目黄金原则。 -->
<!-- hx:manual:end -->
