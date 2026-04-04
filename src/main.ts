import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, type Model, type Api } from "@mariozechner/pi-ai";
import { ConfigManager } from "./config";
import { Logger } from "./logger";
import { CLI } from "./cli";
import {
  listFilesTool,
  readFileTool,
  writeFileTool,
  fileInfoTool,
  searchFilesTool,
  replaceInFileTool,
  listFilesRecursiveTool,
  runCommandTool,
  fetchUrlTool,
  fetchNewsTool,
} from "./tools/index";

function buildModel(config: ReturnType<typeof ConfigManager.load>): Model<Api> {
  const { provider, model, apiKey, apiEndpoint } = config.llm;

  // Set env var for pi-ai's auto-detection
  if (apiKey) {
    const envKeyMap: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      "openai-completions": "OPENAI_API_KEY",
      "openai-responses": "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      mistral: "MISTRAL_API_KEY",
      groq: "GROQ_API_KEY",
      xai: "XAI_API_KEY",
      cerebras: "CEREBRAS_API_KEY",
    };
    const envKey = envKeyMap[provider];
    if (envKey && !process.env[envKey]) {
      process.env[envKey] = apiKey;
    }
  }

  if (apiEndpoint) {
    return {
      id: model,
      name: model,
      api: "openai-completions",
      provider,
      baseUrl: apiEndpoint,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384,
      compat: {
        supportsStore: false,
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
        maxTokensField: "max_tokens",
        supportsStrictMode: false,
      },
    } satisfies Model<"openai-completions">;
  }

  return getModel(provider as any, model as any);
}

function printStartupInfo(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 PI MONO AGENT - 启动参数信息");
  console.log("=".repeat(60));
  
  // 打印命令行参数
  console.log("\n📋 命令行参数:");
  console.log("  Node.js 可执行文件:", process.argv[0]);
  console.log("  脚本文件路径:", process.argv[1]);
  if (process.argv.length > 2) {
    console.log("  配置文件路径:", process.argv[2]);
    for (let i = 3; i < process.argv.length; i++) {
      console.log(`  其他参数 ${i}:`, process.argv[i]);
    }
  } else {
    console.log("  配置文件路径: config.json (默认值)");
  }
  
  // 打印环境变量
  console.log("\n🌍 环境变量:");
  const relevantEnvVars = [
    'NODE_ENV',
    'AGENT_LOG_FILE',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 
    'GOOGLE_API_KEY',
    'MISTRAL_API_KEY',
    'GROQ_API_KEY',
    'XAI_API_KEY',
    'CEREBRAS_API_KEY'
  ];
  
  relevantEnvVars.forEach(key => {
    if (process.env[key]) {
      // 对于敏感信息，只显示部分内容
      let displayValue = process.env[key];
      if (key.includes('KEY') || key.includes('API')) {
        displayValue = displayValue.substring(0, 8) + '***' + displayValue.slice(-4);
      }
      console.log(`  ${key}: ${displayValue}`);
    } else {
      console.log(`  ${key}: (未设置)`);
    }
  });
  
  // 打印其他重要信息
  console.log("\n💻 系统信息:");
  console.log("  工作目录:", process.cwd());
  console.log("  Node.js 版本:", process.version);
  console.log("  平台:", process.platform);
  console.log("  架构:", process.arch);
  
  console.log("=".repeat(60) + "\n");
}

async function main(): Promise<void> {
  // 打印启动参数信息
  printStartupInfo();
  
  const configFilePath = process.argv[2] || "config.json";
  const config = ConfigManager.load(configFilePath);
  ConfigManager.validate(config);

  const model = buildModel(config);
  const logFile = process.env.AGENT_LOG_FILE ?? "agent.log";
  const logger = new Logger(logFile);

  const agent = new Agent({
    initialState: {
      systemPrompt: config.systemPrompt ?? "",
      model,
      tools: [
        listFilesTool,
        readFileTool,
        writeFileTool,
        replaceInFileTool,
        fileInfoTool,
        searchFilesTool,
        listFilesRecursiveTool,
        runCommandTool,
        fetchUrlTool,
        fetchNewsTool,
      ],
    },
    getApiKey: () => config.llm.apiKey,
    onPayload: (payload, m) => {
      logger.logPayload(payload, m);
      return undefined; // 不修改 payload
    },
  });

  agent.subscribe((event) => {
    logger.handleEvent(event);
  });

  const cli = new CLI(agent);
  await cli.start();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exit(1);
});