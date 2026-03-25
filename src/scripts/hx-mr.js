#!/usr/bin/env node
// scripts/hx-mr.js
// 用法: hx mr <feature-name> [--project <group/repo>] [--target <branch>]
// 读取执行计划与需求文档，输出 MR 创建上下文（供 /hx-mr 或 gitlab 脚本使用）

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

import {
  findProgressByTask,
  parseArgs,
  readJsonFile,
} from "./lib/profile-utils.js";
import { resolveContext } from "./lib/resolve-context.js";

const ctx = resolveContext();
const { positional, options } = parseArgs(process.argv.slice(2));
const featureName = positional[0];
const targetBranch =
  typeof options.target === "string" ? options.target : "main";
const project = typeof options.project === "string" ? options.project : null;

if (!featureName) {
  console.error(
    "用法: hx mr <feature-name> [--project <group/repo>] [--target <branch>]",
  );
  console.error("示例: hx mr user-login --project team/backend --target main");
  process.exit(1);
}

const requirementPath = resolve(ctx.requirementDir, `${featureName}.md`);
const progressPath = resolve(ctx.plansDir, `${featureName}-progress.json`);

if (!existsSync(requirementPath) && !existsSync(progressPath)) {
  console.error(`✗ 未找到特性文档: ${featureName}`);
  console.error("  请先运行 hx doc 和 hx plan 创建文档");
  process.exit(1);
}

const progress = existsSync(progressPath) ? readJsonFile(progressPath) : null;
const completedTasks =
  progress?.tasks?.filter((t) => t.status === "done") || [];
const totalTasks = progress?.tasks?.length || 0;

let gitLog = "";
let gitDiff = "";
try {
  gitLog = execSync(
    `git log --oneline --no-merges origin/${targetBranch}..HEAD 2>/dev/null || git log --oneline -10`,
    {
      cwd: ctx.projectRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    },
  ).trim();
  gitDiff = execSync(
    `git diff --stat origin/${targetBranch}..HEAD 2>/dev/null || git diff --stat HEAD~3..HEAD 2>/dev/null || true`,
    {
      cwd: ctx.projectRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    },
  ).trim();
} catch {
  /* 非 git 仓库或无 commits，跳过 */
}

const divider = "─".repeat(60);

console.log(`\n${divider}`);
console.log(`MR 创建上下文 · ${featureName}`);
console.log(divider);

if (existsSync(requirementPath)) {
  const relPath = requirementPath.replace(ctx.projectRoot + "/", "");
  console.log(`\n需求文档: ${relPath}`);
}

if (progress) {
  console.log(`\n任务进度: ${completedTasks.length}/${totalTasks} 已完成`);
  for (const task of progress.tasks) {
    const icon = task.status === "done" ? "✓" : "○";
    console.log(`  ${icon} ${task.id}  ${task.name || ""}`);
  }
}

if (gitLog) {
  console.log("\nCommit 列表:");
  for (const line of gitLog.split("\n").slice(0, 15)) {
    console.log(`  ${line}`);
  }
}

if (gitDiff) {
  console.log("\n变更范围:");
  for (const line of gitDiff.split("\n").slice(0, 10)) {
    console.log(`  ${line}`);
  }
}

console.log(`\n${divider}`);
if (project) {
  console.log(`目标项目: ${project}`);
}
console.log(`目标分支: ${targetBranch}`);
console.log(
  "下一步: 将以上上下文提供给 /hx-mr 命令，或通过 scripts/gitlab mr create 创建 MR",
);
console.log(divider);
