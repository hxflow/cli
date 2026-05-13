#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import agentRun from "../src/commands/agent-run.ts"
import runList from "../src/commands/run-list.ts"
import runGet from "../src/commands/run-get.ts"
import runCancel from "../src/commands/run-cancel.ts"
import login from "../src/commands/login.ts"

const agentCmd = defineCommand({
  meta: { description: "Agent management" },
  subCommands: {
    run: agentRun,
  },
})

const runCmd = defineCommand({
  meta: { description: "Run management" },
  subCommands: {
    list: runList,
    get: runGet,
    cancel: runCancel,
  },
})

const main = defineCommand({
  meta: {
    name: "hx",
    version: "0.1.0",
    description: "hxflow — containerized code agent",
  },
  subCommands: {
    agent: agentCmd,
    run: runCmd,
    login,
  },
})

runMain(main)
