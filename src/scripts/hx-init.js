#!/usr/bin/env node

/**
 * hx init — 初始化当前目录为 Harness Workflow 项目
 *
 * 行为：
 *   1. 创建 docs/requirement 和 docs/plans
 *   2. 创建 .hx/config.json
 *   3. 创建 AGENTS.md 与 .CLAUDE.md 入口
 *   4. 安装 .claude/commands 与 .claude/skills
 *   5. 追加或更新 CLAUDE.md 标记块
 *   6. 如指定自定义 profile，创建 .hx/profiles/<name>/ 骨架
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { resolve } from "path";

import { FRAMEWORK_ROOT } from "./lib/resolve-context.js";
import { ensureClaudeEntrypointLink } from "./lib/install-utils.js";

const HARNESS_MARKER_START = "<!-- harness-workflow:start -->";
const HARNESS_MARKER_END = "<!-- harness-workflow:end -->";
const BUILTIN_PROFILES = ["backend", "frontend", "mobile"];

export function runInit(targetDir, options = {}) {
  const projectRoot = resolve(targetDir || process.cwd());
  const profile = options.profile || "backend";
  const summary = { created: [], skipped: [], updated: [], warnings: [] };

  console.log(`\n  Harness Workflow · init`);
  console.log(`  目标: ${projectRoot}`);
  console.log(`  Profile: ${profile}\n`);

  createProjectStructure(projectRoot, profile, summary);
  installCommands(projectRoot, summary);
  installSkills(projectRoot, summary);
  mergeCLAUDEmd(projectRoot, profile, summary);

  if (!BUILTIN_PROFILES.includes(profile.split(":")[0])) {
    createCustomProfile(projectRoot, profile, summary);
  }

  printSummary(summary);
}

function createProjectStructure(projectRoot, profile, summary) {
  const dirs = [
    resolve(projectRoot, "docs"),
    resolve(projectRoot, "docs", "requirement"),
    resolve(projectRoot, "docs", "plans"),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      summary.created.push(dir.replace(projectRoot + "/", ""));
    }
  }

  const configDir = resolve(projectRoot, ".hx");
  const configPath = resolve(configDir, "config.json");
  if (!existsSync(configPath)) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      configPath,
      `${JSON.stringify(buildConfig(profile), null, 2)}\n`,
      "utf8",
    );
    summary.created.push(".hx/config.json");
  } else {
    summary.skipped.push(".hx/config.json (已存在)");
  }

  const agentsPath = resolve(projectRoot, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    cpSync(resolve(FRAMEWORK_ROOT, "agents", "AGENTS.md"), agentsPath);
    summary.created.push("AGENTS.md");
  } else {
    summary.skipped.push("AGENTS.md (已存在)");
  }

  ensureClaudeEntrypointLink(projectRoot, summary);
}

function buildConfig(profile) {
  return {
    defaultProfile: profile,
    paths: {
      requirement: "docs/requirement",
      plans: "docs/plans",
      src: "src",
      agents: "AGENTS.md",
    },
  };
}

function installCommands(projectRoot, summary) {
  const sourceDir = resolve(FRAMEWORK_ROOT, "agents", "commands");
  const targetDir = resolve(projectRoot, ".claude", "commands");

  if (!existsSync(sourceDir)) {
    summary.warnings.push("框架命令目录不存在: .claude/commands/");
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  const files = readdirSync(sourceDir).filter(
    (fileName) => fileName.startsWith("hx-") && fileName.endsWith(".md"),
  );

  for (const fileName of files) {
    const targetPath = resolve(targetDir, fileName);
    if (existsSync(targetPath)) {
      summary.skipped.push(`.claude/commands/${fileName} (已存在)`);
      continue;
    }
    cpSync(resolve(sourceDir, fileName), targetPath);
    summary.created.push(`.claude/commands/${fileName}`);
  }
}

function installSkills(projectRoot, summary) {
  const sourceDir = resolve(FRAMEWORK_ROOT, "agents", "skills");
  const targetDir = resolve(projectRoot, ".claude", "skills");

  if (!existsSync(sourceDir)) {
    return;
  }

  const skills = readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (skills.length === 0) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  for (const skillName of skills) {
    const targetSkillDir = resolve(targetDir, skillName);
    if (existsSync(targetSkillDir)) {
      summary.skipped.push(`.claude/skills/${skillName}/ (已存在)`);
      continue;
    }
    cpSync(resolve(sourceDir, skillName), targetSkillDir, { recursive: true });
    summary.created.push(`.claude/skills/${skillName}/`);
  }
}

function mergeCLAUDEmd(projectRoot, profile, summary) {
  const claudePath = resolve(projectRoot, "CLAUDE.md");
  const block = buildHarnessBlock(profile);

  if (!existsSync(claudePath)) {
    writeFileSync(claudePath, `${block}\n`, "utf8");
    summary.created.push("CLAUDE.md");
    return;
  }

  const content = readFileSync(claudePath, "utf8");

  if (content.includes(HARNESS_MARKER_START)) {
    const updated = content.replace(
      new RegExp(
        `${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`,
      ),
      block,
    );
    writeFileSync(claudePath, updated, "utf8");
    summary.updated.push("CLAUDE.md (更新 harness 标记块)");
    return;
  }

  writeFileSync(claudePath, `${content.trimEnd()}\n\n${block}\n`, "utf8");
  summary.updated.push("CLAUDE.md (追加 harness 标记块)");
}

function buildHarnessBlock(profile) {
  return `${HARNESS_MARKER_START}
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: \`.hx/config.json\`
- Profile: \`${profile}\`
- 需求文档: \`docs/requirement/\`
- 执行计划: \`docs/plans/\`
- Agent 索引: \`AGENTS.md\`

可用命令: \`/hx-go\` \`/hx-doc\` \`/hx-plan\` \`/hx-run\` \`/hx-review\` \`/hx-gate\` \`/hx-entropy\` \`/hx-mr\`

执行规则和上下文详见 \`AGENTS.md\`
${HARNESS_MARKER_END}`;
}

function createCustomProfile(projectRoot, profile, summary) {
  const profileName = profile.split(":")[0];
  const profileDir = resolve(projectRoot, ".hx", "profiles", profileName);

  if (existsSync(resolve(profileDir, "profile.yaml"))) {
    summary.skipped.push(`.hx/profiles/${profileName}/profile.yaml (已存在)`);
    return;
  }

  mkdirSync(profileDir, { recursive: true });

  let extendsTarget = "base";
  for (const builtin of BUILTIN_PROFILES) {
    if (
      profileName.startsWith(`${builtin}-`) ||
      profileName.startsWith(`${builtin}_`)
    ) {
      extendsTarget = builtin;
      break;
    }
  }

  writeFileSync(
    resolve(profileDir, "profile.yaml"),
    `# 自定义 Profile: ${profileName}
name: ${profileName}
label: ${profileName}
extends: ${extendsTarget}
task_prefix: TASK

# 覆盖门控命令
# gate_commands:
#   lint: "echo lint"
#   test: "echo test"
`,
    "utf8",
  );

  writeFileSync(
    resolve(profileDir, "golden-rules.md"),
    `# ${profileName} 专属黄金原则

> 补充通用 golden-rules.md，以下规则仅适用于 ${profileName}。
`,
    "utf8",
  );

  writeFileSync(
    resolve(profileDir, "review-checklist.md"),
    `# ${profileName} 代码审查清单

## 必须修复

- [ ] （添加团队专属检查项）
`,
    "utf8",
  );

  summary.created.push(`.hx/profiles/${profileName}/profile.yaml`);
  summary.created.push(`.hx/profiles/${profileName}/golden-rules.md`);
  summary.created.push(`.hx/profiles/${profileName}/review-checklist.md`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printSummary(summary) {
  console.log("  ── 安装报告 ──\n");

  if (summary.created.length > 0) {
    console.log("  创建:");
    for (const item of summary.created) console.log(`    + ${item}`);
  }

  if (summary.updated.length > 0) {
    console.log("  更新:");
    for (const item of summary.updated) console.log(`    ~ ${item}`);
  }

  if (summary.skipped.length > 0) {
    console.log("  跳过:");
    for (const item of summary.skipped) console.log(`    - ${item}`);
  }

  if (summary.warnings.length > 0) {
    console.log("  警告:");
    for (const item of summary.warnings) console.log(`    ! ${item}`);
  }

  console.log("\n  完成。使用 /hx-go 开始第一个需求。\n");
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  用法: hx init [--profile <name>] [--target <dir>]

  选项:
    --profile <name>  指定 Profile（默认 backend）
                      内置: backend, frontend, mobile:ios, mobile:android, mobile:harmony
                      自定义: 任意名称，会在 .hx/profiles/ 下生成骨架
    --target <dir>    目标项目目录（默认当前目录）
    --help            显示帮助
  `);
  process.exit(0);
}

let profile = "backend";
let target = process.cwd();

for (let i = 0; i < args.length; i += 1) {
  if ((args[i] === "--profile" || args[i] === "-p") && args[i + 1]) {
    profile = args[++i];
  } else if ((args[i] === "--target" || args[i] === "-t") && args[i + 1]) {
    target = resolve(args[++i]);
  }
}

runInit(target, { profile });
