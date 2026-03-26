#!/usr/bin/env bash
# .claude/hooks/test-on-stop.sh
# Stop hook: 会话结束后，若有文件改动则在 tmux pane 中跑测试；失败时启动子 Agent 修复。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PANE_ID_FILE="/tmp/hx-test-pane-$(echo "$PROJECT_ROOT" | md5sum | cut -c1-8)"
RESULT_FILE="/tmp/hx-test-result-$(echo "$PROJECT_ROOT" | md5sum | cut -c1-8)"
OUTPUT_FILE="/tmp/hx-test-output-$(echo "$PROJECT_ROOT" | md5sum | cut -c1-8)"

# ── 1. 检查 src/ 下是否有文件改动 ────────────────────────────────
cd "$PROJECT_ROOT"
SRC_CHANGED=$(git diff --name-only HEAD -- src/ 2>/dev/null)
SRC_STAGED=$(git diff --cached --name-only -- src/ 2>/dev/null)
if [ -z "$SRC_CHANGED" ] && [ -z "$SRC_STAGED" ]; then
  exit 0
fi

# ── 2. 确认当前在 tmux 中 ────────────────────────────────────────
if [ -z "${TMUX:-}" ]; then
  echo "[hx-hook] 未检测到 tmux 环境，跳过自动测试" >&2
  exit 0
fi

# ── 3. 复用或新建 tmux pane ──────────────────────────────────────
PANE_ID=""
if [ -f "$PANE_ID_FILE" ]; then
  STORED_PANE="$(cat "$PANE_ID_FILE")"
  # 验证 pane 是否仍然存在
  if tmux list-panes -F "#{pane_id}" -a 2>/dev/null | grep -qx "$STORED_PANE"; then
    PANE_ID="$STORED_PANE"
  fi
fi

if [ -z "$PANE_ID" ]; then
  # 在当前 window 底部新建 pane
  PANE_ID="$(tmux split-window -v -P -F "#{pane_id}" -c "$PROJECT_ROOT")"
  echo "$PANE_ID" > "$PANE_ID_FILE"
fi

# ── 4. 清理旧的 result 文件 ──────────────────────────────────────
rm -f "$RESULT_FILE" "$OUTPUT_FILE"

# ── 5. 在 pane 中执行测试，完成后写入 result 文件 ────────────────
TEST_CMD="cd '$PROJECT_ROOT' && echo '[hx-hook] 检测到 src/ 变更，运行单元测试 + 集成测试…' && { npm run hx:test:unit --silent && npm run hx:test:integration --silent; } 2>&1 | tee '$OUTPUT_FILE'; echo \$? > '$RESULT_FILE'"
tmux send-keys -t "$PANE_ID" "$TEST_CMD" Enter

# ── 6. 等待测试完成（最多 3 分钟）───────────────────────────────
WAIT=0
while [ ! -f "$RESULT_FILE" ] && [ $WAIT -lt 180 ]; do
  sleep 2
  WAIT=$((WAIT + 2))
done

if [ ! -f "$RESULT_FILE" ]; then
  echo "[hx-hook] 测试超时（180s），跳过子 Agent" >&2
  exit 0
fi

EXIT_CODE="$(cat "$RESULT_FILE")"

if [ "$EXIT_CODE" = "0" ]; then
  tmux send-keys -t "$PANE_ID" "echo '[hx-hook] ✓ 所有测试通过'" Enter
  exit 0
fi

# ── 7. 测试失败：启动 Claude 子 Agent 自动修复 ───────────────────
FAILURE_OUTPUT="$(cat "$OUTPUT_FILE" 2>/dev/null | tail -200)"

FIX_PROMPT="测试运行失败，请分析错误原因并直接修复 src/ 下的代码，不要修改测试文件本身。修复后重新运行测试确认通过。

失败输出：
\`\`\`
$FAILURE_OUTPUT
\`\`\`"

FIX_CMD="cd '$PROJECT_ROOT' && claude --dangerously-skip-permissions -p $(printf '%q' "$FIX_PROMPT")"
tmux send-keys -t "$PANE_ID" "$FIX_CMD" Enter
