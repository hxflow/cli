# 获取需求并创建需求文档

## 执行步骤

1. 执行 `bun scripts/tools/doc.ts context <feature>`，读取当前需求来源、已注册模板和现有需求文档事实。
2. 生成或续接 `docs/requirement/{feature}.md`，再执行 `bun scripts/tools/doc.ts validate <feature>` 根据校验结果修正头部和正文。
3. 输出前新开一个子 agent 评审一次，并根据评审结论修正。

## 下一步

- `hx plan <feature>`

## 约束

- 先复用后生成，已有头部字段优先沿用脚本返回的事实
- `displayName`、`sourceId`、`sourceFingerprint` 与 `Type` 统一以运行时事实为准
- 只修正文档头部和正文，不扩展额外契约层
