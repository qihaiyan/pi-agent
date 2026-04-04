import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

// ── list_files ──────────────────────────────────────────
const listFilesParams = Type.Object({
  path: Type.Optional(Type.String({ description: "目录路径，默认为当前目录" })),
});

export const listFilesTool: AgentTool<typeof listFilesParams> = {
  name: "list_files",
  label: "List Files",
  description: "列出指定目录下的文件和文件夹",
  parameters: listFilesParams,
  execute: async (_id, params) => {
    const dirPath = resolve(params.path || ".");
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const lines = entries.map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`);
    return { content: [{ type: "text", text: lines.join("\n") }], details: {} };
  },
};

// ── read_file ───────────────────────────────────────────
const readFileParams = Type.Object({
  path: Type.String({ description: "要读取的文件路径" }),
});

export const readFileTool: AgentTool<typeof readFileParams> = {
  name: "read_file",
  label: "Read File",
  description: "读取指定文件的文本内容",
  parameters: readFileParams,
  execute: async (_id, params) => {
    const content = readFileSync(resolve(params.path), "utf-8");
    return { content: [{ type: "text", text: content }], details: {} };
  },
};

// ── write_file ──────────────────────────────────────────
const writeFileParams = Type.Object({
  path: Type.String({ description: "要写入的文件路径" }),
  content: Type.String({ description: "要写入的文件内容" }),
});

export const writeFileTool: AgentTool<typeof writeFileParams> = {
  name: "write_file",
  label: "Write File",
  description: "将内容写入指定文件（覆盖已有内容）",
  parameters: writeFileParams,
  execute: async (_id, params) => {
    const filePath = resolve(params.path);
    writeFileSync(filePath, params.content, "utf-8");
    return { content: [{ type: "text", text: `已写入 ${filePath}` }], details: {} };
  },
};

// ── file_info ───────────────────────────────────────────
const fileInfoParams = Type.Object({
  path: Type.String({ description: "文件或目录路径" }),
});

export const fileInfoTool: AgentTool<typeof fileInfoParams> = {
  name: "file_info",
  label: "File Info",
  description: "获取文件或目录的元信息（大小、修改时间等）",
  parameters: fileInfoParams,
  execute: async (_id, params) => {
    const filePath = resolve(params.path);
    const stat = statSync(filePath);
    const info = {
      path: filePath,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
    };
    return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }], details: {} };
  },
};

// ── search_files ────────────────────────────────────────
const searchFilesParams = Type.Object({
  path: Type.Optional(Type.String({ description: "搜索的根目录，默认当前目录" })),
  pattern: Type.String({ description: "要搜索的文本或正则表达式" }),
  glob: Type.Optional(Type.String({ description: "文件名匹配模式，如 *.ts" })),
});

export const searchFilesTool: AgentTool<typeof searchFilesParams> = {
  name: "search_files",
  label: "Search Files",
  description: "在文件内容中搜索匹配的文本，返回匹配行及上下文",
  parameters: searchFilesParams,
  execute: async (_id, params) => {
    const root = resolve(params.path || ".");
    const regex = new RegExp(params.pattern, "gi");
    const globPattern = params.glob;
    const results: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          if (globPattern && !matchGlob(entry.name, globPattern)) continue;
          try {
            const content = readFileSync(full, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push(`${relative(root, full)}:${i + 1}: ${lines[i].trim()}`);
                if (results.length >= 100) return;
              }
              regex.lastIndex = 0;
            }
          } catch { /* 跳过二进制文件 */ }
        }
      }
    }

    walk(root);
    const text = results.length ? results.join("\n") : "未找到匹配结果";
    return { content: [{ type: "text", text }], details: {} };
  },
};

function matchGlob(name: string, pattern: string): boolean {
  const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  return re.test(name);
}

// ── replace_in_file ─────────────────────────────────────
const replaceInFileParams = Type.Object({
  path: Type.String({ description: "文件路径" }),
  oldText: Type.String({ description: "要被替换的原始文本（精确匹配）" }),
  newText: Type.String({ description: "替换后的新文本" }),
});

export const replaceInFileTool: AgentTool<typeof replaceInFileParams> = {
  name: "replace_in_file",
  label: "Replace In File",
  description: "精确替换文件中的一段文本，比覆盖整个文件更安全",
  parameters: replaceInFileParams,
  execute: async (_id, params) => {
    const filePath = resolve(params.path);
    const content = readFileSync(filePath, "utf-8");
    const idx = content.indexOf(params.oldText);
    if (idx === -1) {
      return { content: [{ type: "text", text: "未找到匹配的文本，替换失败" }], details: {} };
    }
    // 检查是否有多处匹配
    const secondIdx = content.indexOf(params.oldText, idx + 1);
    if (secondIdx !== -1) {
      return { content: [{ type: "text", text: "找到多处匹配，请提供更精确的文本以避免误替换" }], details: {} };
    }
    const updated = content.slice(0, idx) + params.newText + content.slice(idx + params.oldText.length);
    writeFileSync(filePath, updated, "utf-8");
    return { content: [{ type: "text", text: `已替换 ${filePath} 中的文本` }], details: {} };
  },
};

// ── list_files_recursive ────────────────────────────────
const listFilesRecursiveParams = Type.Object({
  path: Type.Optional(Type.String({ description: "根目录路径，默认当前目录" })),
  maxDepth: Type.Optional(Type.Number({ description: "最大递归深度，默认 4" })),
});

export const listFilesRecursiveTool: AgentTool<typeof listFilesRecursiveParams> = {
  name: "list_files_recursive",
  label: "List Files Recursive",
  description: "递归列出目录树结构，快速了解项目布局",
  parameters: listFilesRecursiveParams,
  execute: async (_id, params) => {
    const root = resolve(params.path || ".");
    const maxDepth = params.maxDepth ?? 4;
    const lines: string[] = [];
    let count = 0;
    const limit = 500;

    function walk(dir: string, prefix: string, depth: number) {
      if (depth > maxDepth || count >= limit) return;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch { return; }

      // 排序：目录在前
      entries.sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
        return a.isDirectory() ? -1 : 1;
      });

      for (let i = 0; i < entries.length; i++) {
        if (count >= limit) break;
        const entry = entries[i];
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const isLast = i === entries.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const childPrefix = isLast ? "    " : "│   ";
        const label = entry.isDirectory() ? `${entry.name}/` : entry.name;
        lines.push(`${prefix}${connector}${label}`);
        count++;
        if (entry.isDirectory()) {
          walk(resolve(dir, entry.name), prefix + childPrefix, depth + 1);
        }
      }
    }

    lines.push(relative(process.cwd(), root) || ".");
    walk(root, "", 1);
    if (count >= limit) lines.push(`...(已截断，共 ${count} 条)`);
    return { content: [{ type: "text", text: lines.join("\n") }], details: {} };
  },
};
