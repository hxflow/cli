import { defineCommand } from "citty"
import { runAgentRun } from "../agent-run.ts"

export default defineCommand({
  meta: { description: "Run the hxflow agent on a requirement" },
  args: {
    prompt: { type: "string", alias: "p", description: "Requirement text" },
    file: { type: "string", alias: "f", description: "Path to requirement .md file" },
    cwd: { type: "string", alias: "C", description: "Local repo directory to mount" },
    repo: { type: "string", description: "Remote repo URL to clone" },
    name: { type: "string", alias: "n", description: "Human-readable run label" },
    profile: { type: "string", description: "Profile name (default/readonly/ci-strict)" },
    model: { type: "string", description: "LLM model override" },
    budget: { type: "string", description: "USD budget limit (default: 5)" },
    timeout: { type: "string", description: "Timeout in seconds (default: 1800)" },
    backend: { type: "string", description: "Backend: podman|docker|k8s (default: podman)" },
    image: { type: "string", description: "Container image override" },
    detach: { type: "boolean", alias: "d", description: "Start and return immediately" },
  },
  async run({ args }) {
    try {
      const code = await runAgentRun({
        prompt: args.prompt,
        file: args.file,
        cwd: args.cwd,
        repo: args.repo,
        name: args.name,
        profile: args.profile,
        model: args.model,
        budget: args.budget ? parseFloat(args.budget) : undefined,
        timeout: args.timeout ? parseInt(args.timeout) : undefined,
        backend: args.backend as "docker" | "podman" | "k8s" | undefined,
        image: args.image,
        detach: args.detach,
      })
      process.exit(code)
    } catch (err) {
      console.error(String(err))
      process.exit(10)
    }
  },
})
