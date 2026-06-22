import type { z } from "zod";

export type AgentDefinition<TSchema extends z.ZodType = z.ZodType> = {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  outputSchema: TSchema;
  temperature: number;
};
