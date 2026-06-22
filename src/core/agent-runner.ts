import type { z } from "zod";

import type { AgentDefinition } from "@/schemas/agent";
import { OpenAICompatibleProvider } from "@/providers/openai-compatible";

export function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  throw new Error("Agent response did not contain a JSON object.");
}

export async function runAgent<TSchema extends z.ZodType>(input: {
  agent: AgentDefinition<TSchema>;
  prompt: string;
  maxTokens?: number;
}) {
  const provider = new OpenAICompatibleProvider();
  const raw = await provider.generateText({
    system: input.agent.systemPrompt,
    prompt: input.prompt,
    temperature: input.agent.temperature,
    maxTokens: input.maxTokens,
  });

  const parsed = JSON.parse(extractJsonObject(raw));
  return input.agent.outputSchema.parse(parsed) as z.infer<TSchema>;
}
