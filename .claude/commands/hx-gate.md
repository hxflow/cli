# 质量门控

无需参数，在 harness-scaffold 目录下运行全部检查。

## 执行步骤

在 `harness-scaffold/` 目录下按顺序执行以下检查，任一失败即停止并报告：

### Step 1: Lint
```bash
cd harness-scaffold && npm run hx:lint 2>&1
```
- 零容忍模式（--max-warnings 0）
- 失败时输出具体的 lint 错误和文件位置
- 提示：运行 `npm run hx:lint:fix` 可自动修复部分问题

### Step 2: TypeScript 类型检查
```bash
cd harness-scaffold && npm run hx:type 2>&1
```
- 不产生输出文件，仅检查类型
- 失败时输出类型错误的文件和行号

### Step 3: 单元测试
```bash
cd harness-scaffold && npm run hx:test 2>&1
```
- 使用 Vitest，verbose 模式输出
- 失败时输出失败的测试用例和断言

### Step 4: 架构合规测试
```bash
cd harness-scaffold && npm run hx:arch 2>&1
```
- 检查跨层导入是否存在违规
- 失败时输出违规的文件和导入路径

## 输出格式

全部通过：
```
── 质量门控 ──────────────────────────
✓ Step 1/4  Lint          通过
✓ Step 2/4  TypeCheck     通过
✓ Step 3/4  Unit Tests    通过（XX 个测试）
✓ Step 4/4  Arch Test     通过

全部通过，可以提交 PR。
```

部分失败：
```
✓ Step 1/4  Lint          通过
✗ Step 2/4  TypeCheck     失败

错误详情:
  src/service/authService.ts:34 — Type 'string' is not assignable to type 'number'

门控未通过，请修复后重新运行 /hx-gate
```

## 注意
- 如果 harness-scaffold 中尚未安装依赖（node_modules 不存在），先运行 `npm install`
- 如果某个 script 不存在（项目刚初始化），跳过该步骤并标记为 ⚠ 跳过
