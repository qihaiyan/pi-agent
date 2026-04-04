import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

const fetchUrlParams = Type.Object({
  url: Type.String({ description: "要请求的 URL" }),
  method: Type.Optional(Type.String({ description: "HTTP 方法，默认 GET" })),
  headers: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "请求头" })),
  body: Type.Optional(Type.String({ description: "请求体（POST/PUT 时使用）" })),
});

export const fetchUrlTool: AgentTool<typeof fetchUrlParams> = {
  name: "fetch_url",
  label: "Fetch URL",
  description: "发送 HTTP 请求并返回响应内容",
  parameters: fetchUrlParams,
  execute: async (_id, params) => {
    const { url, method = "GET", headers, body } = params;
    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
        signal: AbortSignal.timeout(30000),
      });
      const contentType = resp.headers.get("content-type") || "";
      let text: string;
      if (contentType.includes("json")) {
        const json = await resp.json();
        text = JSON.stringify(json, null, 2);
      } else {
        text = await resp.text();
        // 截断过长的 HTML
        if (text.length > 20000) {
          text = text.slice(0, 20000) + "\n...(已截断)";
        }
      }
      return {
        content: [{ type: "text", text: `HTTP ${resp.status}\n\n${text}` }],
        details: {},
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `请求失败: ${err.message}` }],
        details: {},
      };
    }
  },
};
