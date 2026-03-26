# 发布 npm 包并推送到 GitLab

参数: `$ARGUMENTS`（可选: `patch | minor | major`，默认 `patch`；`--dry-run` 仅预演不执行；`--skip-tests` 跳过测试）

## 执行步骤

### 0. 解析参数

- bump 类型：`patch`（默认）/ `minor` / `major`
- `--dry-run`：全程只打印命令，不实际执行
- `--skip-tests`：跳过测试步骤

### 1. 前置检查

依次运行以下检查，任一失败立即停止：

```bash
# 1a. 确认在 git 仓库中
git rev-parse --git-dir

# 1b. 工作区必须干净（无未提交改动）
git status --porcelain
```

若 `git status --porcelain` 有输出，报错：
> 工作区有未提交的改动，请先 commit 或 stash 后再发布。

```bash
# 1c. 读取当前分支
git branch --show-current

# 1d. 确认 package.json 存在
cat package.json
```

记录当前版本号（`version` 字段）和 `publishConfig.registry`（若存在）。

### 2. 运行测试（除非 --skip-tests）

```bash
npx vitest run
```

测试失败立即停止，输出失败详情。

### 3. Bump 版本号

读取 `package.json` 中的当前版本，按 bump 类型计算新版本：

- `patch`：`x.y.z` → `x.y.(z+1)`
- `minor`：`x.y.z` → `x.(y+1).0`
- `major`：`x.y.z` → `(x+1).0.0`

使用 `npm version <bump-type> --no-git-tag-version` 只更新文件，不自动打 tag：

```bash
npm version <bump-type> --no-git-tag-version
```

读取更新后的版本号，记为 `NEW_VERSION`。

### 4. Commit 版本变更

```bash
git add package.json
git commit -m "chore: release v<NEW_VERSION>"
```

### 5. 打 Git Tag

```bash
git tag v<NEW_VERSION>
```

### 6. 发布到 npm 仓库

```bash
npm publish
```

若 `package.json` 有 `publishConfig.registry`，npm 会自动使用该地址（`.npmrc` 中应已配置认证信息）。

发布失败时：
- 回滚 tag：`git tag -d v<NEW_VERSION>`
- 回滚 commit：`git reset --soft HEAD~1`
- 报告错误原因，停止

### 7. 推送到 GitLab

```bash
# 推送当前分支的 commit
git push

# 推送 tag
git push origin v<NEW_VERSION>
```

推送失败时报告错误，tag 和 commit 已在本地，提示用户手动 push。

### 8. 输出发布报告

```
── 发布完成 ─────────────────────────────
✓ 版本   <OLD_VERSION> → <NEW_VERSION>
✓ 包名   <name>
✓ 仓库   <publishConfig.registry 或 默认>
✓ Tag    v<NEW_VERSION>
✓ 推送   <remote>/<branch>

运行 npm install @<scope>/<name>@<NEW_VERSION> 验证安装
```

## --dry-run 模式

在每个步骤前输出 `[dry-run]` 前缀，只打印命令，不执行任何写操作（npm version / npm publish / git commit / git push 均跳过）。

## 说明

- `.npmrc` 中必须提前配置好私有仓库的认证 token，否则 `npm publish` 会报 401
- `package.json` 的 `publishConfig.registry` 决定发布目标，本项目指向 `https://npm.cdfsunrise.com/`
- 本命令不修改 `CHANGELOG`，如需生成变更记录请在此之前手动维护
