import OpenAI from "openai";
import { z } from "zod";

const providerSettingsSchema = z.object({
  apiKey: z.string().min(1),
  baseURL: z.string().url().default("https://api.openai.com/v1"),
  model: z.string().min(1).default("gpt-4.1"),
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
    });
  }

  async generateText(input: GenerateTextInput) {
    const response = await this.client.chat.completions.create({
      model: input.model ?? this.settings.model,
      temperature: input.temperature ?? 0.8,
      max_tokens: input.maxTokens ?? 1800,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Model returned an empty response.");
    }

    return content;
  }
}
