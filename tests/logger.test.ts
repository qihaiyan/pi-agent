import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Logger } from "../src/logger";

describe("Logger", () => {
  const logFiles: string[] = [];

  function createLogger(): { logger: Logger; logFile: string } {
    const logFile = join(tmpdir(), `agent-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
    logFiles.push(logFile);
    return { logger: new Logger(logFile), logFile };
  }

  function readLog(logFile: string): string {
    return readFileSync(logFile, "utf-8");
  }

  afterEach(() => {
    for (const f of logFiles) {
      try { unlinkSync(f); } catch {}
    }
    logFiles.length = 0;
  });

  describe("handleEvent", () => {
    it("should log agent_start to file", () => {
      const { logger, logFile } = createLogger();
      logger.handleEvent({ type: "agent_start" });
      expect(readLog(logFile)).toContain("Agent started");
    });

    it("should log agent_end with message count", () => {
      const { logger, logFile } = createLogger();
      logger.handleEvent({ type: "agent_end", messages: [{} as any, {} as any] });
      expect(readLog(logFile)).toContain("2 messages");
    });

    it("should log tool_execution_start with name and args", () => {
      const { logger, logFile } = createLogger();
      logger.handleEvent({
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "list_files",
        args: { path: "." },
      });
      const output = readLog(logFile);
      expect(output).toContain("list_files");
      expect(output).toContain('"path":"."');
    });

    it("should log tool_execution_end with result", () => {
      const { logger, logFile } = createLogger();
      logger.handleEvent({
        type: "tool_execution_end",
        toolCallId: "tc1",
        toolName: "list_files",
        result: { content: [{ type: "text", text: "file.txt" }] },
        isError: false,
      });
      const output = readLog(logFile);
      expect(output).toContain("Tool result");
      expect(output).toContain("isError=false");
    });

    it("should not write when logFile is null", () => {
      const logger = new Logger(null);
      // Should not throw
      logger.handleEvent({ type: "agent_start" });
      logger.logError(new Error("test"));
    });
  });

  describe("logError", () => {
    it("should log error message to file", () => {
      const { logger, logFile } = createLogger();
      logger.logError(new Error("Something went wrong"));
      expect(readLog(logFile)).toContain("Something went wrong");
    });
  });
});
