// src/features/ai-summary/llm-client.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { AiSummaryResponse } from "../types/ai-summary.types";

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  async generate(prompt: string, symbol: string): Promise<AiSummaryResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const baseUrl = process.env.LITELLM_API_BASE || "https://api.openai.com/v1";

    if (!this.isApiKeyValid(apiKey)) {
      this.logger.warn(`API Key not configured for ${symbol}, using fallback`);
      throw new Error("LLM API key not configured");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an elite financial analyst. Output only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("Empty response from LLM");

    return this.parseResponse(content);
  }

  private isApiKeyValid(key?: string): boolean {
    return !!(key && key.length > 30 && !key.includes("REPLACE"));
  }

  private parseResponse(content: string): AiSummaryResponse {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (
      !parsed.summary ||
      !parsed.sentiment ||
      typeof parsed.confidence !== "number"
    ) {
      throw new Error("Invalid AI response schema");
    }

    return parsed as AiSummaryResponse;
  }
}
