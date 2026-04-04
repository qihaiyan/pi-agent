import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

const runCommandParams = Type.Object({
  command: Type.String({ description: "要执行的 shell 命令" }),
  cwd: Type.Optional(Type.String({ description: "工作目录，默认当前目录" })),
  timeout: Type.Optional(Type.Number({ description: "超时时间（毫秒），默认 30000" })),
});

export const runCommandTool: AgentTool<typeof runCommandParams> = {
  name: "run_command",
  label: "Run Command",
  description: "执行 shell 命令并返回标准输出。超时默认 30 秒。",
  parameters: runCommandParams,
  execute: async (_id, params) => {
    const cwd = resolve(params.cwd || ".");
    const timeout = params.timeout ?? 30000;
    try {
      const stdout = execSync(params.command, {
        cwd,
        encoding: "utf-8",
        timeout,
        maxBuffer: 1024 * 1024, // 1 MB
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { content: [{ type: "text", text: stdout }], details: {} };
    } catch (err: any) {
      const stderr = err.stderr ?? "";
      const stdout = err.stdout ?? "";
      const output = [stdout, stderr].filter(Boolean).join("\n---\n");
      return {
        content: [{ type: "text", text: `命令执行失败 (exit ${err.status ?? "?"})\n${output}` }],
        details: {},
      };
    }
  },
};
