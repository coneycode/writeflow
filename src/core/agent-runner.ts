import { ZodError, type z } from "zod";

import type { AgentDefinition } from "@/schemas/agent";
import { OpenAICompatibleProvider } from "@/providers/openai-compatible";
import { currentProgress } from "@/core/run-progress";

export class AgentOutputFormatError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AgentOutputFormatError";
  }
}

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

  throw new AgentOutputFormatError("Agent response did not contain a JSON object.", text);
}

function parseAgentOutput<TSchema extends z.ZodType>(agent: AgentDefinition<TSchema>, raw: string) {
  try {
    const parsed = JSON.parse(extractJsonObject(raw));
    const normalized = agent.normalizeOutput ? agent.normalizeOutput(parsed) : parsed;
    return agent.outputSchema.parse(normalized) as z.infer<TSchema>;
  } catch (error) {
    if (error instanceof AgentOutputFormatError) {
      throw error;
    }
    if (error instanceof SyntaxError || error instanceof ZodError) {
      throw new AgentOutputFormatError(error instanceof SyntaxError ? "Agent response contained invalid JSON." : "Agent response JSON did not match schema.", raw, error);
    }
    throw error;
  }
}

function repairPrompt(input: { agent: AgentDefinition; originalPrompt: string; rawOutput: string; error: unknown }) {
  return `你的上一次回复没有满足系统要求，导致无法解析。

错误：${input.error instanceof Error ? input.error.message : String(input.error)}

请只根据下面的【原始任务】重新输出一次，必须满足：
- 只输出一个 JSON object；
- 不要输出 Markdown；
- 不要输出代码块；
- 不要输出解释文字；
- 必须符合 ${input.agent.name} 的输出 schema。

【原始任务】
${input.originalPrompt}

【上一次无效输出】
${input.rawOutput.slice(0, 6000)}`;
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

    try {
      const result = parseAgentOutput(input.agent, raw);
      if (stepId) {
        progress?.endStep(stepId, "completed");
      }
      return result;
    } catch (formatError) {
      if (!(formatError instanceof AgentOutputFormatError)) {
        throw formatError;
      }
      if (progress?.isCancelled) {
        throw new Error("Run cancelled.");
      }

      const repairedRaw = await provider.generateText({
        system: input.agent.systemPrompt,
        prompt: repairPrompt({
          agent: input.agent,
          originalPrompt: input.prompt,
          rawOutput: raw,
          error: formatError.cause ?? formatError,
        }),
        temperature: 0,
        maxTokens: input.maxTokens,
        signal: progress?.signal,
      });
      const result = parseAgentOutput(input.agent, repairedRaw);
      if (stepId) {
        progress?.endStep(stepId, "completed");
      }
      return result;
    }
  } catch (error) {
    if (stepId) {
      progress?.endStep(stepId, "failed");
    }
    throw error;
  }
}
