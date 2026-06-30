import OpenAI from "openai";
import { z } from "zod";

const providerSettingsSchema = z.object({
  apiKey: z.string().min(1),
  baseURL: z.string().url().default("https://api.openai.com/v1"),
  model: z.string().min(1).default("gpt-4.1"),
  timeoutMs: z.coerce.number().int().positive().default(900000),
  maxRetries: z.coerce.number().int().min(0).default(1),
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

export type GenerateTextInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** 提供后，使用流式请求并对每个增量片段回调（用于实时进度展示）。 */
  onToken?: (token: string) => void;
  /** 取消信号：abort 时进行中的请求立即抛错。 */
  signal?: AbortSignal;
};

export function loadProviderSettings(): ProviderSettings {
  const parsed = providerSettingsSchema.safeParse({
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.OPENAI_COMPATIBLE_MODEL ?? "gpt-4.1",
    timeoutMs: process.env.OPENAI_COMPATIBLE_TIMEOUT_MS,
    maxRetries: process.env.OPENAI_COMPATIBLE_MAX_RETRIES,
  });

  if (!parsed.success) {
    throw new Error("Missing model settings. Set OPENAI_COMPATIBLE_API_KEY, OPENAI_COMPATIBLE_BASE_URL, and OPENAI_COMPATIBLE_MODEL in .env.local.");
  }

  return parsed.data;
}

export class OpenAICompatibleProvider {
  private client: OpenAI;
  private settings: ProviderSettings;

  constructor(settings = loadProviderSettings()) {
    this.settings = settings;
    this.client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      timeout: settings.timeoutMs,
      maxRetries: settings.maxRetries,
    });
  }

  async generateText(input: GenerateTextInput) {
    const model = input.model ?? this.settings.model;
    const maxTokens = input.maxTokens ?? 1800;
    const messages = [
      { role: "system" as const, content: input.system },
      { role: "user" as const, content: input.prompt },
    ];

    try {
      if (input.onToken) {
        const stream = await this.client.chat.completions.create(
          {
            model,
            temperature: input.temperature ?? 0.8,
            max_tokens: maxTokens,
            messages,
            stream: true,
          },
          { signal: input.signal },
        );

        let content = "";
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content ?? "";
          if (token) {
            content += token;
            input.onToken(token);
          }
        }

        if (!content) {
          throw new Error("Model returned an empty response.");
        }
        return content;
      }

      const response = await this.client.chat.completions.create(
        {
          model,
          temperature: input.temperature ?? 0.8,
          max_tokens: maxTokens,
          messages,
        },
        { signal: input.signal },
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Model returned an empty response.");
      }
      return content;
    } catch (error) {
      console.error("OpenAI-compatible request failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        maxRetries: this.settings.maxRetries,
        maxTokens,
        model,
        promptCharacters: input.prompt.length,
        streaming: Boolean(input.onToken),
        timeoutMs: this.settings.timeoutMs,
      });
      throw error;
    }
  }
}
