import type { z } from "zod";

import type { AgentDefinition } from "@/schemas/agent";
import { OpenAICompatibleProvider } from "@/providers/openai-compatible";
import { currentProgress } from "@/core/run-progress";

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
  /** 子步骤标签，如 "变体 A · 第 2 场 / 共 5 场"。 */
  label?: string;
}) {
  const provider = new OpenAICompatibleProvider();
  const progress = currentProgress();

  // 已请求中止：不再开新一步（多步任务在步骤之间即停）。
  if (progress?.isCancelled) {
    throw new Error("Run cancelled.");
  }

  const stepId = progress?.startStep({
    agent: input.agent.name,
    label: input.label ?? input.agent.name,
    promptPreview: input.prompt,
  });

  try {
    const raw = await provider.generateText({
      system: input.agent.systemPrompt,
      prompt: input.prompt,
      temperature: input.agent.temperature,
      maxTokens: input.maxTokens,
      onToken: stepId ? (token) => progress?.appendToken(stepId, token) : undefined,
      signal: progress?.signal,
    });

    const parsed = JSON.parse(extractJsonObject(raw));
    const result = input.agent.outputSchema.parse(parsed) as z.infer<TSchema>;
    if (stepId) {
      progress?.endStep(stepId, "completed");
    }
    return result;
  } catch (error) {
    if (stepId) {
      progress?.endStep(stepId, "failed");
    }
    throw error;
  }
}
