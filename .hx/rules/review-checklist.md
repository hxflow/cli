<!-- hx:auto:start -->
# Review Checklist

## 机验项

- 当前需求对应的 `requirementDoc`、`planDoc`、`progressFile` 是否存在且可读取。
- `requirementDoc` 头部的 `Feature`、`Display Name`、`Source ID`、`Source Fingerprint` 是否符合固定格式。
- `progressFile` 是否能通过固定 schema 校验，且关键字段非空。
- `.hx/config.yaml` 中引用的主要路径和已启用 gate 是否为非空字符串。
- 与本次变更直接相关的脚本、配置、文档路径是否真实存在。

## 人工审查项

### 范围与一致性

- 变更是否严格围绕当前需求，没有混入无关修改。
- 命名、目录、接口和数据结构是否与现有代码保持一致。
- 新增配置、文档、脚本是否与当前项目事实一致。

### 架构与分层检查

- 改动是否落在已有目录边界内，如 `src`。
- 是否引入了不必要的新层次、新中间抽象或重复实现。
- 依赖方向是否符合当前项目已有分层。

### 错误处理与健壮性

- 错误分支是否完整，可定位，可恢复或可上抛。
- 是否存在空 `catch`、裸 `throw`、吞错或不透明兜底。
- 输入边界、空值、异常返回是否有处理。

### 测试与质量门

- 是否执行了项目已有质量门：test=`npm run hx:test`；lint/build/type 未配置。
- 无法执行的检查是否给出明确原因。
- 行为变化是否有对应测试、用例或验证步骤。

### 技术栈专项检查

- 是否遵守当前技术栈 `Node.js + ESM CLI，JavaScript，Vitest` 的既有约定。
- 构建、类型、测试、代码风格配置是否被破坏。
- 与脚本、配置、文档相关的改动是否同步更新到位。
<!-- hx:auto:end -->

<!-- hx:manual:start -->
<!-- 团队可在这里补充额外的审查清单。 -->
<!-- hx:manual:end -->
