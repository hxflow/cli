#!/usr/bin/env bash
# auto-fix-issues.sh — 每30分钟拉取 ai-fix issues 并自动修复、创建 MR
set -euo pipefail

REPO_DIR="/Users/eleven/qiyuan-harness-workflow"
GITLAB_API="https://gitlab.cdfsunrise.com/api/v4/projects/frontend%2Fqybot%2Fqiyuan-harness-guide"
LOG_FILE="$REPO_DIR/scripts/auto-fix.log"
CLAUDE_BIN="/Users/eleven/.local/bin/claude"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# 若环境变量未设置，尝试从 Claude Code settings.local.json 读取
if [[ -z "${GITLAB_TOKEN:-}" ]]; then
  SETTINGS_FILE="$HOME/.claude/settings.local.json"
  if [[ -f "$SETTINGS_FILE" ]]; then
    GITLAB_TOKEN=$(python3 -c "
import json, sys
with open('$SETTINGS_FILE') as f:
    d = json.load(f)
print(d.get('env', {}).get('GITLAB_TOKEN', ''))
" 2>/dev/null || echo "")
  fi
fi

if [[ -z "${GITLAB_TOKEN:-}" ]]; then
  log "ERROR: GITLAB_TOKEN 未设置，请在 ~/.claude/settings.local.json 的 env 中配置"
  exit 1
fi

log "===== 开始拉取 ai-fix issues ====="

# 获取所有带 ai-fix label 的开放 issue
ISSUES=$(curl -sf \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API/issues?labels=ai-fix&state=opened&per_page=20")

ISSUE_COUNT=$(echo "$ISSUES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
log "发现 $ISSUE_COUNT 个待修复 issue"

if [[ "$ISSUE_COUNT" -eq 0 ]]; then
  log "无待处理 issue，退出"
  exit 0
fi

cd "$REPO_DIR"

# 将每个 issue 写入临时文件，避免管道中 IFS 分割问题
TMPDIR_ISSUES=$(mktemp -d)
trap 'rm -rf "$TMPDIR_ISSUES"' EXIT

echo "$ISSUES" | python3 -c "
import sys, json, os
issues = json.load(sys.stdin)
tmpdir = sys.argv[1]
for i in issues:
    path = os.path.join(tmpdir, str(i['iid']) + '.json')
    with open(path, 'w') as f:
        json.dump({'iid': i['iid'], 'title': i['title'], 'description': i['description'] or ''}, f)
" "$TMPDIR_ISSUES"

for ISSUE_FILE in "$TMPDIR_ISSUES"/*.json; do
  IID=$(python3 -c "import json; d=json.load(open('$ISSUE_FILE')); print(d['iid'])")
  TITLE=$(python3 -c "import json; d=json.load(open('$ISSUE_FILE')); print(d['title'])")
  DESCRIPTION=$(python3 -c "import json; d=json.load(open('$ISSUE_FILE')); print(d['description'])")

  log "处理 issue #$IID: $TITLE"

  BRANCH="fix/issue-$IID"

  # 若分支已存在则跳过
  if git ls-remote --exit-code --heads origin "$BRANCH" &>/dev/null; then
    log "分支 $BRANCH 已存在，跳过"
    continue
  fi

  # 切换到最新 main
  git fetch origin main --quiet
  git checkout -B "$BRANCH" origin/main --quiet

  PROMPT="你正在处理 GitLab Issue #${IID}。

标题：${TITLE}

描述：
${DESCRIPTION}

任务：
1. 分析问题，找到相关源码
2. 实现修复，确保不破坏现有功能
3. 运行测试（pnpm vitest run）确认通过
4. 提交代码（使用 /commit 命令）
5. 推送分支到远端：git push origin ${BRANCH}
6. 使用 /hx-mr 创建 Merge Request，标题包含 'fix: #${IID}'，描述中关联 issue

请开始修复。"

  log "启动 Claude 修复 issue #$IID ..."
  (cd "$REPO_DIR" && "$CLAUDE_BIN" --dangerously-skip-permissions -p "$PROMPT") \
    >> "$LOG_FILE" 2>&1 && log "issue #$IID 修复完成" \
    || log "issue #$IID 修复失败，查看日志"

  # 切回 main 准备下一个
  git checkout main --quiet
done

log "===== 本轮处理完成 ====="
