import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigManager } from "../src/config.js";
import { AgentErrorType } from "../src/types/index.js";

describe("ConfigManager", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "AGENT_PROVIDER",
    "AGENT_MODEL",
    "AGENT_API_KEY",
    "AGENT_API_ENDPOINT",
    "AGENT_SYSTEM_PROMPT",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  function writeTempConfig(content: string): string {
    const filePath = join(tmpdir(), `agent-config-${Date.now()}.json`);
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  describe("load", () => {
    it("should load config from environment variables", () => {
      process.env.AGENT_PROVIDER = "openai";
      process.env.AGENT_MODEL = "gpt-4";
      process.env.AGENT_API_KEY = "sk-test-key";
      process.env.AGENT_API_ENDPOINT = "https://api.openai.com/v1";
      process.env.AGENT_SYSTEM_PROMPT = "You are helpful.";

      const config = ConfigManager.load();

      expect(config.llm.provider).toBe("openai");
      expect(config.llm.model).toBe("gpt-4");
      expect(config.llm.apiKey).toBe("sk-test-key");
      expect(config.llm.apiEndpoint).toBe("https://api.openai.com/v1");
      expect(config.systemPrompt).toBe("You are helpful.");
    });

    it("should load config from a JSON file", () => {
      const filePath = writeTempConfig(
        JSON.stringify({
          llm: {
            provider: "anthropic",
            model: "claude-3",
            apiKey: "key-from-file",
          },
          systemPrompt: "File prompt",
        }),
      );

      try {
        const config = ConfigManager.load(filePath);
        expect(config.llm.provider).toBe("anthropic");
        expect(config.llm.model).toBe("claude-3");
        expect(config.llm.apiKey).toBe("key-from-file");
        expect(config.systemPrompt).toBe("File prompt");
      } finally {
        unlinkSync(filePath);
      }
    });

    it("should prioritize environment variables over config file", () => {
      process.env.AGENT_PROVIDER = "env-provider";
      process.env.AGENT_MODEL = "env-model";

      const filePath = writeTempConfig(
        JSON.stringify({
          llm: {
            provider: "file-provider",
            model: "file-model",
            apiEndpoint: "https://file-endpoint.com",
          },
        }),
      );

      try {
        const config = ConfigManager.load(filePath);
        expect(config.llm.provider).toBe("env-provider");
        expect(config.llm.model).toBe("env-model");
        expect(config.llm.apiEndpoint).toBe("https://file-endpoint.com");
      } finally {
        unlinkSync(filePath);
      }
    });

    it("should throw CONFIG_PARSE_ERROR for invalid JSON", () => {
      const filePath = writeTempConfig("{ not valid json }");

      try {
        expect(() => ConfigManager.load(filePath)).toThrowError(
          expect.objectContaining({ type: AgentErrorType.CONFIG_PARSE_ERROR }),
        );
      } finally {
        unlinkSync(filePath);
      }
    });

    it("should throw CONFIG_PARSE_ERROR for non-existent file", () => {
      expect(() =>
        ConfigManager.load("/nonexistent/path/config.json"),
      ).toThrowError(
        expect.objectContaining({ type: AgentErrorType.CONFIG_PARSE_ERROR }),
      );
    });

    it("should return empty strings when no env vars or file provided", () => {
      const config = ConfigManager.load();
      expect(config.llm.provider).toBe("");
      expect(config.llm.model).toBe("");
      expect(config.systemPrompt).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should pass for valid config", () => {
      expect(() =>
        ConfigManager.validate({
          llm: { provider: "openai", model: "gpt-4" },
        }),
      ).not.toThrow();
    });

    it("should throw CONFIG_ERROR when provider is empty", () => {
      expect(() =>
        ConfigManager.validate({
          llm: { provider: "", model: "gpt-4" },
        }),
      ).toThrowError(
        expect.objectContaining({ type: AgentErrorType.CONFIG_ERROR }),
      );
    });

    it("should throw CONFIG_ERROR when model is empty", () => {
      expect(() =>
        ConfigManager.validate({
          llm: { provider: "openai", model: "" },
        }),
      ).toThrowError(
        expect.objectContaining({ type: AgentErrorType.CONFIG_ERROR }),
      );
    });
  });
});
