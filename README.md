# hx — hxflow CLI

容器化 code agent CLI，对标 [Warp oz](https://docs.warp.dev/reference/cli)。  
在 ephemeral Podman / Docker 容器中运行 hxflow agent，完成 `doc → plan → run → review → mr` 五段工作流。

## 安装

### Binary（推荐）

```bash
# macOS arm64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-darwin-arm64 \
  -o /usr/local/bin/hx && chmod +x /usr/local/bin/hx

# macOS x64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-darwin-x64 \
  -o /usr/local/bin/hx && chmod +x /usr/local/bin/hx

# Linux arm64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-linux-arm64 \
  -o /usr/local/bin/hx && chmod +x /usr/local/bin/hx

# Linux x64
curl -L https://github.com/hxflow/cli/releases/latest/download/hx-linux-x64 \
  -o /usr/local/bin/hx && chmod +x /usr/local/bin/hx
```

> **命名冲突**：系统已装 [helix 编辑器](https://helix-editor.com/)（也叫 `hx`）时，建议安装为 `hxflow` 或调整 `$PATH` 顺序。

### npm（备用）

```bash
echo "@hxflow:registry=https://npm.pkg.github.com" >> ~/.npmrc
bun install -g @hxflow/cli
```

## 快速开始

```bash
# 1. 登录（二选一）

# 方式 A：Codex（OpenAI ChatGPT OAuth，已装 codex CLI 则直接激活）
hx login --provider codex

# 方式 B：pi（Anthropic OAuth）
hx login
# 或直接设 API key
export ANTHROPIC_API_KEY=sk-ant-...

# 2. 拉取 agent 镜像
podman pull ghcr.io/hxflow/agent:latest

# 3. 在当前仓库运行
cd ~/my-project
hx agent run --prompt "实现 /api/health 端点并加单测"

# 4. 查看结果
hx run list
hx run get <RUN_ID>
hx run get <RUN_ID> --trace   # 查看完整事件流
```

## 命令参考

```
hx agent run [OPTIONS]                     运行 hxflow agent
hx run list [--limit N]                    列出历史 run
hx run get <ID> [--trace]                  查看 run 详情
hx run cancel <ID>                         取消正在运行的 run
hx login [--provider pi|codex] [--status]  登录 / 查看 auth 状态
```

### `hx agent run` 选项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--prompt / -p` | | 需求文本 |
| `--file / -f` | | 需求 .md 文件路径 |
| `--cwd / -C` | `$(pwd)` | 挂载本地仓库目录（跳过 clone）|
| `--repo` | | 远程仓库 URL（CLI 自动 clone）|
| `--name / -n` | | 运行标签 |
| `--environment / -e` | `default` | 见下方 Environments |
| `--timeout` | `1800` | 超时秒数 |
| `--model` | | 模型 override（如 `claude-opus-4-7`）|
| `--image` | config | 容器镜像 override |
| `--backend` | config | `podman` / `docker` / `k8s` |
| `--detach / -d` | | 后台启动，立即返回 |

## Auth

### Codex（OpenAI）

```bash
hx login --provider codex   # 读取 ~/.codex/auth.json，激活 codex 为默认 provider
hx login --status           # 查看当前 provider 及 token 过期时间
```

已安装并登录 [Codex CLI](https://github.com/openai/codex) 时，`hx login --provider codex` 直接复用其 ChatGPT OAuth token，无需重新授权。

### pi（Anthropic）

```bash
hx login           # 启动 pi OAuth 流程
# 或
export ANTHROPIC_API_KEY=sk-ant-...
```

## Environments

Environment 是一份完整的运行档案：镜像、资源限制、网络、LLM provider、**注入容器的 env 集合**。一个环境一份配置，跑哪个用哪份——灵感来自 Warp environment / Codex Cloud env。

文件位置：`~/.hx/environments/<name>.yaml`

```yaml
name: hxflow-cloud
image: ghcr.io/hxflow/agent:v1
auth:
  provider: anthropic        # anthropic / openai / openai-codex
  apiKeyEnv: ANTHROPIC_API_KEY
limits:
  timeoutSec: 1800
  memoryMB: 4096
  cpus: 2
network: bridge              # bridge / none / host
env:
  # ① 字面值
  HX_LOG_LEVEL: info
  # ② 宿主 env 插值：${VAR} 缺失为空串；${VAR:?msg} 缺失即报错
  GH_TOKEN: ${GH_TOKEN}
  GITLAB_TOKEN: ${GITLAB_TOKEN:?gitlab token required}
  # ③ 文件引用：!file <path>，读宿主文件内容、trim 末尾换行
  WUSHUANG_TOKEN: !file ~/.config/wushuang/token
```

CLI 加载时一次性解析所有插值/文件引用，得到纯 `Record<string, string>` 传给容器。失败（必填缺失、文件不存在）立即终止 run，容器不启动。

内置 environment：`default` / `codex` / `readonly` / `ci-strict`。

## 控制台

Web 控制台由独立包 `@hxflow/console` 提供，不挂到 `hx` 子命令下：

```bash
hx-console              # 启动，自动打开浏览器
hx-console --no-open    # 启动，不打开浏览器
hx-console --status     # 查看 server 状态
hx-console --stop       # 停止
```

> **LAN 安全提示**：控制台默认监听 `0.0.0.0:7878`，URL 中包含 token 鉴权（`~/.hx/console/token`，权限 0600）。勿在公网运行。

## Run 存储

所有产物落在 `~/.hx/runs/<run-id>/`（runId 是 UUID v7）：

```
manifest.json   — 调用参数快照
result.json     — {err, msg, data:{...}} 统一信封；agent 元数据 + LLM 业务字段
trace.jsonl     — 完整事件流（pi 事件 + hx marker，逐行 JSON）
```

result.json 详细字段切分参见 `@hxflow/shared` 的 `AgentResponse` / `AgentResultData`。

## CI 接入

无需安装 CLI，直接用容器契约：

```yaml
- name: hxflow agent
  run: |
    podman run --rm \
      -e ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }} \
      -e REQUIREMENT="${{ inputs.requirement }}" \
      -e HX_TIMEOUT_SEC=1200 \
      -v ${{ github.workspace }}:/workspace \
      -v ${{ runner.temp }}/hx-out:/output \
      ghcr.io/hxflow/agent:latest

- name: Show result
  run: cat ${{ runner.temp }}/hx-out/result.json
```

## 配置

`~/.hx/config.yaml`：

```yaml
backend: podman                            # podman | docker | k8s
image: ghcr.io/hxflow/agent:latest
environment: default                       # 见上方 Environments 节
workspaceBase: /mnt/data/hx-workspaces    # 可选，大磁盘存放 clone 的 workspace
```
