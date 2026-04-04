import { readFileSync } from "node:fs";
import { AgentConfig } from "./types/index";
import { AgentError, AgentErrorType } from "./types/index";

export class ConfigManager {
  static load(configFilePath?: string): AgentConfig {
    let fileConfig: Partial<AgentConfig> = {};

    if (configFilePath) {
      fileConfig = ConfigManager.loadFromFile(configFilePath);
    }

    const config: AgentConfig = {
      llm: {
        provider:
          process.env.AGENT_PROVIDER ??
          fileConfig.llm?.provider ??
          "",
        model:
          process.env.AGENT_MODEL ??
          fileConfig.llm?.model ??
          "",
        apiKey:
          process.env.AGENT_API_KEY ??
          fileConfig.llm?.apiKey,
        apiEndpoint:
          process.env.AGENT_API_ENDPOINT ??
          fileConfig.llm?.apiEndpoint,
      },
      systemPrompt:
        process.env.AGENT_SYSTEM_PROMPT ??
        fileConfig.systemPrompt,
    };

    return config;
  }

  static validate(config: AgentConfig): void {
    if (!config.llm.provider) {
      throw new AgentError(
        AgentErrorType.CONFIG_ERROR,
        "Missing required configuration: llm.provider",
      );
    }
    if (!config.llm.model) {
      throw new AgentError(
        AgentErrorType.CONFIG_ERROR,
        "Missing required configuration: llm.model",
      );
    }
  }

  private static loadFromFile(filePath: string): Partial<AgentConfig> {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      throw new AgentError(
        AgentErrorType.CONFIG_PARSE_ERROR,
        `Failed to read config file: ${filePath}`,
        (err as Error).message,
      );
    }

    try {
      return JSON.parse(content) as Partial<AgentConfig>;
    } catch (err) {
      throw new AgentError(
        AgentErrorType.CONFIG_PARSE_ERROR,
        `Invalid JSON in config file: ${filePath}`,
        (err as Error).message,
      );
    }
  }
}
