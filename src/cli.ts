import {
  TUI,
  ProcessTerminal,
  Text,
  Markdown,
  Spacer,
  Editor,
  Loader,
  matchesKey,
  Key,
  type EditorTheme,
  type MarkdownTheme,
  type SelectListTheme,
} from "@mariozechner/pi-tui";
import type { Agent } from "@mariozechner/pi-agent-core";

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const gray = (s: string) => `\x1b[90m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;
const italic = (s: string) => `\x1b[3m${s}\x1b[23m`;
const strikethrough = (s: string) => `\x1b[9m${s}\x1b[29m`;
const underline = (s: string) => `\x1b[4m${s}\x1b[24m`;
const identity = (s: string) => s;

const selectListTheme: SelectListTheme = {
  selectedPrefix: cyan,
  selectedText: bold,
  description: gray,
  scrollInfo: gray,
  noMatch: gray,
};

const editorTheme: EditorTheme = {
  borderColor: gray,
  selectList: selectListTheme,
};

const markdownTheme: MarkdownTheme = {
  heading: bold,
  link: cyan,
  linkUrl: gray,
  code: yellow,
  codeBlock: identity,
  codeBlockBorder: gray,
  quote: italic,
  quoteBorder: gray,
  hr: gray,
  listBullet: cyan,
  bold,
  italic,
  strikethrough,
  underline,
};

export class CLI {
  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  async start(): Promise<void> {
    const terminal = new ProcessTerminal();
    const tui = new TUI(terminal);

    tui.addChild(new Text("Welcome to Pi-Mono Agent!", 1, 0));
    tui.addChild(new Text(gray('Type your message. Press Enter to send, Ctrl+C to quit.'), 1, 0));
    tui.addChild(new Spacer(1));

    const editor = new Editor(tui, editorTheme);
    tui.addChild(editor);
    tui.setFocus(editor);

    let streamedText = "";
    let currentMd: Markdown | null = null;
    let loader: Loader | null = null;

    const unsubscribe = this.agent.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        streamedText += event.assistantMessageEvent.delta;

        // 第一个 delta 到达时，移除 loader，插入 Markdown 组件
        if (!currentMd) {
          if (loader) {
            loader.stop();
            tui.removeChild(loader);
            loader = null;
          }
          currentMd = new Markdown(streamedText, 1, 0, markdownTheme);
          tui.addChild(currentMd);
        } else {
          currentMd.setText(streamedText);
        }
        tui.requestRender();
      }

      // 检测 LLM 返回的错误（stopReason === "error"）
      if (event.type === "message_end") {
        const msg = event.message as any;
        if (msg.stopReason === "error" && msg.errorMessage) {
          if (loader) {
            loader.stop();
            tui.removeChild(loader);
            loader = null;
          }
          tui.addChild(new Text(`\x1b[31mLLM Error: ${msg.errorMessage}\x1b[39m`, 1, 0));
          tui.requestRender();
        }
      }
    });

    editor.onSubmit = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (trimmed === "exit" || trimmed === "quit") {
        unsubscribe();
        tui.stop();
        terminal.write("Goodbye!\n");
        process.exit(0);
      }

      // 显示用户消息
      tui.removeChild(editor);
      tui.addChild(new Text(green("You: ") + trimmed, 1, 0));
      tui.addChild(new Spacer(1));

      // 重置流式状态
      streamedText = "";
      currentMd = null;

      // 显示加载动画
      loader = new Loader(tui, cyan, gray, "Thinking...");
      tui.addChild(loader);
      loader.start();

      editor.disableSubmit = true;
      tui.requestRender();

      this.agent.prompt(trimmed).then(() => {
        if (loader) {
          loader.stop();
          tui.removeChild(loader);
          loader = null;
        }

        // 确保最终文本已设置
        if (currentMd) {
          currentMd.setText(streamedText);
        }

        tui.addChild(new Spacer(1));
        tui.addChild(editor);
        tui.setFocus(editor);
        editor.setText("");
        editor.disableSubmit = false;
        tui.requestRender();
      }).catch((error: unknown) => {
        if (loader) {
          loader.stop();
          tui.removeChild(loader);
          loader = null;
        }
        if (currentMd) {
          tui.removeChild(currentMd);
          currentMd = null;
        }

        const msg = error instanceof Error ? error.message : String(error);
        tui.addChild(new Text(`\x1b[31mError: ${msg}\x1b[39m`, 1, 0));
        tui.addChild(new Spacer(1));
        tui.addChild(editor);
        tui.setFocus(editor);
        editor.setText("");
        editor.disableSubmit = false;
        tui.requestRender();
      });
    };

    tui.addInputListener((data) => {
      if (matchesKey(data, Key.ctrl("c"))) {
        unsubscribe();
        this.agent.abort();
        tui.stop();
        terminal.write("\nGoodbye!\n");
        process.exit(0);
      }
      return undefined;
    });

    tui.start();
  }
}
