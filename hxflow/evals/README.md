# HX Evals

这是一套可持续迭代的 agent evals 骨架，不是一次性 `evals.json`。

## 目录

- `datasets/*.jsonl`：样本池，按 `core / edge / regressions` 分层
- `specs/default.json`：当前默认评测组合
- `runs/history.json`：历次跑分趋势
- `../../scripts/lib/evals.ts`：校验、评分、趋势报告、失败样本提取、OpenAI Evals payload 导出

## 推荐节奏

1. 日常开发后先跑 `validate`
2. 有真实 agent 输出后跑 `score`
3. 重要分支或每周把结果 `record` 到 `runs/history.json`
4. 从失败 run 中提取候选样本，再人工整理进 `regressions.jsonl`

## 本地命令

```bash
# 校验数据集格式（无需 agent，CI 必跑）
npm run hx:evals:validate

# 用 claude CLI 自动驱动全量评测（无需 API Key，本地 Claude Code 即可）
npm run hx:evals:run                    # 仅打分，结果写 /tmp/
npm run hx:evals:run:record             # 打分 + 写入 history.json
npm run hx:evals:run:ci                 # 打分 + 写入 + 通过率不达标则 exit 1

# 底层工具（手动流程用）
bun hxflow/scripts/lib/evals.ts score tests/fixtures/evals/sample-results.json --write-run /tmp/hx-eval-run.json
bun hxflow/scripts/lib/evals.ts report
bun hxflow/scripts/lib/evals.ts extract-failures /tmp/hx-eval-run.json --output /tmp/hx-eval-candidates.jsonl
```

## 自动化驱动流程（run-evals.ts）

`hxflow/scripts/run-evals.ts` 用本地 `claude CLI` 驱动每条 case：

1. 加载 SKILL.md + 所有命令契约作为 system context
2. 用 `claude -p "<input>"` 获取模型输出（禁用工具，防止误操作）
3. 调用 `evals.ts score` 打分，输出 JSON 摘要

**Case 类型与局限：**

| case 类型 | 检查项 | 是否可自动化 |
|-----------|--------|-------------|
| 知识问答（描述规则） | mustInclude / mustNotInclude | ✅ 完全支持 |
| 操作指令（需工具调用） | requiredToolCalls | ⚠️ 需沙箱环境（worktree） |

`requiredToolCalls` 类型的 case 在无工具模式下永远失败。解决方案：将此类 case 的 input 改为问答风格（"应该修改哪些文件？"），或搭建隔离沙箱后去掉 `--tools ""` 限制。

## 推荐节奏

1. 日常开发后跑 `npm run hx:evals:run`
2. 重要分支或每周跑 `npm run hx:evals:run:record`，把分数写入历史
3. 从失败 run 中提取候选样本，再人工整理进 `datasets/regressions.jsonl`

## OpenAI Evals 对接

官方文档建议持续评测，并把生产失败样本持续回灌到回归集：

- https://platform.openai.com/docs/guides/evals?api-mode=responses
- https://platform.openai.com/docs/guides/evaluation-best-practices
- https://platform.openai.com/docs/api-reference/evals/getRuns

本仓库的 `openai-payload` 子命令只负责把本地数据集整理成一个可提交给 OpenAI Evals API 的 payload 草稿。真实接入时，需要按你的 agent 输出 schema 把 `sample.output_text`、tool call 字段和 grader 规则接到实际运行结果上。
