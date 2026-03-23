# Phase 01 · 创建需求文档

参数: $ARGUMENTS（feature-name，kebab-case 格式）

## 执行步骤

1. 校验参数：如果未提供 feature-name，提示用法 `/hx-doc user-login` 并停止
2. 检查 `harness-scaffold/docs/design/$ARGUMENTS.md` 是否已存在，存在则提示并停止
3. 读取模板文件 `harness-scaffold/docs/design/_template.md`
4. 基于模板创建 `harness-scaffold/docs/design/$ARGUMENTS.md`，自动填入：
   - feature-name 替换占位符
   - 今天的日期
   - 状态设为「草稿」
5. 以交互方式引导用户逐步填写以下必填字段：
   - **背景**：需求来源和动机（1-3 句话）
   - **验收标准（AC）**：每条必须可自动化测试验证，包含具体的 HTTP 方法/字段名/状态码/阈值。提醒用户：模糊的 AC（如"要快""要好用"）无法驱动 Agent 执行
   - **影响的架构层级**：勾选 Types / Config / Repo / Service / Runtime / UI
   - **边界约束**：明确本期不做什么
6. 可选字段（询问用户是否需要填写）：
   - 接口定义（请求/响应类型）
   - 错误码表
   - 依赖文档
   - 设计决策
7. 完成后输出摘要，并提示下一步：
   ```
   ✓ 需求文档已创建: docs/design/$ARGUMENTS.md
   下一步: /hx-plan $ARGUMENTS
   ```

## 质量检查

- AC 中不允许出现「要快」「友好提示」「安全性要好」这类模糊描述
- 如果检测到模糊 AC，主动建议用户改为可量化的版本（如：P95 < 200ms、返回 401 + 具体 code）
