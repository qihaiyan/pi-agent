export interface AgentConfig {
  llm: {
    provider: string;    // pi-ai provider name: "openai", "anthropic", "google", etc.
    model: string;       // model name: "gpt-4o", "claude-sonnet-4-20250514", etc.
    apiKey?: string;     // optional: override env var for API key
    apiEndpoint?: string; // optional: custom endpoint for OpenAI-compatible APIs
  };
  systemPrompt?: string;
}
