export enum AgentErrorType {
  CONFIG_ERROR = "CONFIG_ERROR",
  CONFIG_PARSE_ERROR = "CONFIG_PARSE_ERROR",
  LLM_AUTH_ERROR = "LLM_AUTH_ERROR",
  LLM_NETWORK_ERROR = "LLM_NETWORK_ERROR",
  LLM_RATE_LIMIT = "LLM_RATE_LIMIT",
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_EXECUTION_ERROR = "TOOL_EXECUTION_ERROR",
}

export class AgentError extends Error {
  type: AgentErrorType;
  details?: string;

  constructor(type: AgentErrorType, message: string, details?: string) {
    super(message);
    this.name = "AgentError";
    this.type = type;
    this.details = details;
  }
}
