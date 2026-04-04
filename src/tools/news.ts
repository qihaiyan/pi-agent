import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const DEFAULT_SOURCES: Record<string, string> = {
  "36kr": "https://36kr.com/feed",
};

function parseRssItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    if (title) {
      items.push({ title, link: link || "", pubDate: pubDate || "", source });
    }
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  // 处理 CDATA: <![CDATA[...]]>
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const cdataMatch = cdataRe.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

async function fetchRss(url: string, source: string): Promise<NewsItem[]> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseRssItems(xml, source);
  } catch {
    return [];
  }
}

// ── fetch_news ──────────────────────────────────────────
const fetchNewsParams = Type.Object({
  source: Type.Optional(Type.String({ description: "新闻源名称：36kr 或 sspai，不填则获取全部" })),
  limit: Type.Optional(Type.Number({ description: "每个源返回的条数，默认 10" })),
});

export const fetchNewsTool: AgentTool<typeof fetchNewsParams> = {
  name: "fetch_news",
  label: "Fetch News",
  description: "从 36氪、少数派获取最新新闻，返回标题、链接和发布时间",
  parameters: fetchNewsParams,
  execute: async (_id, params) => {
    const limit = params.limit ?? 10;
    let sources: [string, string][];

    if (params.source && DEFAULT_SOURCES[params.source]) {
      sources = [[params.source, DEFAULT_SOURCES[params.source]]];
    } else {
      sources = Object.entries(DEFAULT_SOURCES);
    }

    const allItems: NewsItem[] = [];
    const results = await Promise.allSettled(
      sources.map(([name, url]) => fetchRss(url, name)),
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        allItems.push(...r.value.slice(0, limit));
      }
    }

    if (allItems.length === 0) {
      return { content: [{ type: "text", text: "未能获取到新闻，请检查网络连接" }], details: {} };
    }

    const lines = allItems.map(
      (item, i) => `${i + 1}. [${item.source}] ${item.title}\n   ${item.link}\n   ${item.pubDate}`,
    );
    return { content: [{ type: "text", text: lines.join("\n\n") }], details: {} };
  },
};
