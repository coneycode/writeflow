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
    let response;

    try {
      response = await this.client.chat.completions.create({
        model,
        temperature: input.temperature ?? 0.8,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      });
    } catch (error) {
      console.error("OpenAI-compatible request failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        maxRetries: this.settings.maxRetries,
        maxTokens,
        model,
        promptCharacters: input.prompt.length,
        timeoutMs: this.settings.timeoutMs,
      });
      throw error;
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Model returned an empty response.");
    }

    return content;
  }
}
