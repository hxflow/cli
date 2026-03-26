## 待完成需求

1. ~~commands添加hook，pre & post~~ ✓ 已在各 /hx-* 命令中定义 hook 路径约定
2. ~~自定义编排全自动流程~~ ✓ /hx-go 实现全流水线，4 个检查点
3. ~~下一步命令提醒以及当前任务状态~~ ✓ /hx-done 输出下一步提示
4. 需要集成测试功能
5. 知识探索阶段

## AI-first 架构重构（已完成）

- CLI 精简为 5 个命令：setup / upgrade / uninstall / gate / doctor
- 删除所有"prompt 组装"JS 脚本（hx-agent-run、hx-agent-fix、hx-scan 等）
- 所有 /hx-* Claude 命令重写为直接 AI 指令（不依赖 CLI 中间层）
- /hx-init 改为 Claude 直接用工具分析项目并生成 profile

