# hx — hxflow CLI

Containerized code agent CLI, modeled after [Warp oz](https://docs.warp.dev/reference/cli).  
Runs the `hxflow` agent (`doc → plan → run → review → mr`) inside an ephemeral Podman container.

## Install

### Binary（推荐）

```bash
# macOS arm64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-darwin-arm64 -o /usr/local/bin/hx
chmod +x /usr/local/bin/hx

# macOS x64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-darwin-x64 -o /usr/local/bin/hx
chmod +x /usr/local/bin/hx

# Linux arm64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-linux-arm64 -o /usr/local/bin/hx
chmod +x /usr/local/bin/hx
```

> **命名冲突**：如果系统已安装 [helix 编辑器](https://helix-editor.com/)（也叫 `hx`），建议把 hxflow CLI 安装为 `hxflow` 或调整 `$PATH` 顺序。

### npm（备用）

```bash
# 配置 GitHub Packages
echo "@hxflow:registry=https://npm.pkg.github.com" >> ~/.npmrc

bun install -g @hxflow/cli
# 或 npm install -g @hxflow/cli
```

## 快速开始

```bash
# 1. 登录（二选一）

# 方式 A：使用 Codex（OpenAI ChatGPT OAuth，推荐）
hx login --provider codex   # 已登录 codex 则直接激活，否则触发 device auth 流程

# 方式 B：使用 pi（Anthropic OAuth 或 API key）
hx login                    # pi OAuth 流程
export ANTHROPIC_API_KEY=sk-ant-...   # 或直接设 key

# 2. 拉取 agent 镜像
podman pull ghcr.io/hxflow/agent:v0.1

# 3. 在当前仓库运行
cd ~/my-project
hx agent run --prompt "实现 /api/health 端点并加单测"

# 4. 查看历史
hx run list
hx run get <RUN_ID>
hx run get <RUN_ID> --trace   # 看完整事件流
```

## 命令

```
hx agent run [OPTIONS]                    运行 hxflow agent
hx run list [--limit N]                   列出历史 run
hx run get <ID> [--trace]                 查看 run 详情
hx run cancel <ID>                        取消正在运行的 run
hx login [--provider pi|codex] [--status] 登录 / 查看 auth 状态
hx ui [--no-open] [--stop]                启动/停止 Web UI
```

### `hx agent run` 选项

| 参数 | 说明 |
|------|------|
| `--prompt / -p` | 需求文本 |
| `--file / -f` | 需求 .md 文件路径 |
| `--cwd / -C` | 挂载本地仓库目录（不 clone）|
| `--repo` | 远程仓库 URL（CLI 自动 clone）|
| `--profile` | `default` / `readonly` / `ci-strict` |
| `--budget` | USD 预算上限（默认 5.00）|
| `--timeout` | 超时秒数（默认 1800）|
| `--model` | 模型 override（如 `claude-opus-4-7`）|
| `--image` | 容器镜像 override |
| `--detach / -d` | 后台启动，立即返回 |

## CI 接入

无需安装 CLI，直接用容器契约：

```yaml
- name: hxflow agent
  run: |
    podman run --rm \
      -e ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }} \
      -e REQUIREMENT="${{ inputs.requirement }}" \
      -e HX_BUDGET_USD=2.00 \
      -e HX_TIMEOUT_SEC=1200 \
      -v ${{ github.workspace }}:/workspace \
      -v ${{ runner.temp }}/hx-out:/output \
      ghcr.io/hxflow/agent:v0.1

- name: Show result
  run: cat ${{ runner.temp }}/hx-out/result.json
```

## Profiles

| Profile | network | timeout | 用途 |
|---------|---------|---------|------|
| `default` | bridge | 1800s | 日常开发 |
| `readonly` | none | 900s | 代码审查、只读分析 |
| `ci-strict` | none | 1200s | CI 管道，严格隔离 |

自定义 profile 放在 `~/.hx/profiles/<name>.yaml`。

## Web UI

```bash
hx ui                    # 启动，自动打开浏览器
hx ui --no-open          # 启动，不打开浏览器
hx ui --status           # 查看状态
hx ui --stop             # 停止
```

> **LAN 安全提示**：UI 默认监听 `0.0.0.0:7878`，局域网内可访问。  
> URL 中包含 token（存于 `~/.hx/ui/token`，权限 0600）。  
> 不要在公网环境运行，或用 `--host 127.0.0.1` 限制为本机访问。

## Run 存储

所有产物落在 `~/.hx/runs/<run-id>/`：

```
manifest.json   — 参数快照
result.json     — 状态、token 用量、耗时、MR URL
trace.jsonl     — 完整事件流（含 LLM 调用）
diff.patch      — 代码变更
```

## 配置

`~/.hx/config.yaml`：

```yaml
backend: podman          # podman | docker | k8s
image: ghcr.io/hxflow/agent:v0.1
profile: default
workspaceBase: /mnt/data/hx-workspaces   # 可选，大磁盘存 workspace clone
```
