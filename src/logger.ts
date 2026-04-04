import { appendFileSync } from "node:fs";
import type { AgentEvent } from "@mariozechner/pi-agent-core";

export class Logger {
  private logFile: string | null;

  /**
   * @param logFile 日志文件路径。为 null 时不输出日志。
   */
  constructor(logFile: string | null = null) {
    this.logFile = logFile;
  }

  private write(message: string): void {
    if (!this.logFile) return;
    try {
      appendFileSync(this.logFile, message);
    } catch {
      // 写入失败时静默忽略，不干扰 TUI
    }
  }

  /** 处理 agent 事件并记录日志 */
  handleEvent(event: AgentEvent): void {
    const ts = new Date().toISOString();

    switch (event.type) {
      case "agent_start":
        this.write(`[${ts}] Agent started\n`);
        break;
      case "agent_end":
        this.write(`[${ts}] Agent ended, ${event.messages.length} messages\n`);
        break;
      case "tool_execution_start":
        this.write(
          `[${ts}] Tool call: ${event.toolName}, args=${JSON.stringify(event.args)}\n`,
        );
        break;
      case "tool_execution_end":
        this.write(
          `[${ts}] Tool result: ${event.toolName}, isError=${event.isError}, result=${JSON.stringify(event.result)}\n`,
        );
        break;
      case "message_end": {
        const msg = event.message as any;
        if (msg.role === "assistant") {
          this.write(`[${ts}] LLM Response:\n  ${JSON.stringify(msg, null, 2)}\n`);
        }
        break;
      }
    }
  }

  /** 记录 LLM 请求 payload */
  logPayload(payload: unknown, model: { id: string; provider: string }): void {
    const ts = new Date().toISOString();
    this.write(
      `[${ts}] LLM Request [${model.provider}/${model.id}]:\n  ${JSON.stringify(payload, null, 2)}\n`,
    );
  }

  /** 记录错误 */
  logError(error: Error): void {
    const ts = new Date().toISOString();
    this.write(`[${ts}] Error: ${error.message}\n`);
  }
}
