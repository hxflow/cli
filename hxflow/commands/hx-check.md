# 核心检查入口

## 执行步骤

1. 执行 `bun scripts/tools/check.ts [<feature>] [--scope <scope>]`；若无 bun 则执行 `npx tsx scripts/tools/check.ts [<feature>] [--scope <scope>]`，读取检查范围、质量门结果和审查输入事实。
2. `review` / `clean` 只报告问题；`qa` 只看 gate 结果。
3. gate 失败时停止并输出问题；通过后进入后续交付阶段。

## 下一步

- `hx mr <feature>`

## 约束

- qa 只看 exit code，不看命令输出文本
- clean 只做扫描和报告，不修改任何文件
- review / clean 不直接执行修复
- gate 失败时先修复再重试
- scope 语义与返回事实统一以脚本为准
