/**
 * LLM 客户端 — 对应 Python 的 extractors/llm_client.py
 *
 * 支持 deepseek / qwen / openai 等 OpenAI 兼容接口
 */

import OpenAI from "openai";
import { config } from "@/lib/config";

const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
  qwen: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export class LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(opts?: { provider?: string; apiKey?: string; baseUrl?: string; model?: string }) {
    const provider = opts?.provider || config.LLM_PROVIDER;
    const preset = PROVIDER_PRESETS[provider] || {};

    const apiKey = opts?.apiKey || config.LLM_API_KEY;
    const baseUrl = opts?.baseUrl || config.LLM_BASE_URL || preset.baseUrl;
    this.model = opts?.model || config.LLM_MODEL || preset.model;

    if (!apiKey) {
      throw new Error(`LLM API key not configured. Set LLM_API_KEY in .env for provider '${provider}'.`);
    }

    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    console.log(`[LLM] Initialized: provider=${provider}, model=${this.model}`);
  }

  /** 调用 LLM 对话, 返回文本响应 */
  async chat(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; responseFormatJson?: boolean }
  ): Promise<string> {
    const temperature = options?.temperature ?? 0.3;
    const responseFormatJson = options?.responseFormatJson ?? true;

    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    };

    if (responseFormatJson) {
      params.response_format = { type: "json_object" };
    }

    const response = await this.client.chat.completions.create(params);
    const content = response.choices[0]?.message?.content || "";
    return content;
  }

  /** 调用 LLM 并返回解析后的 dict */
  async chatJson(systemPrompt: string, userPrompt: string, temperature = 0.3): Promise<Record<string, any>> {
    const content = await this.chat(systemPrompt, userPrompt, { temperature });

    try {
      return JSON.parse(content);
    } catch {
      // 尝试从文本中提取 JSON 片段
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // ignore
        }
      }
      console.error(`[LLM] Invalid JSON response: ${content.slice(0, 200)}`);
      return {};
    }
  }
}
