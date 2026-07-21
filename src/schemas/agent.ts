import type { z } from "zod";

export type AgentDefinition<TSchema extends z.ZodType = z.ZodType> = {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  outputSchema: TSchema;
  temperature: number;
  /**
   * Optional deterministic normalizer applied to the parsed JSON before Zod validation.
   * Use this for low-risk contract repairs such as enum aliases or null optional fields;
   * narrative/content decisions must stay in the calling workflow.
   */
  normalizeOutput?: (value: unknown) => unknown;
};
