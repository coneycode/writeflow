import { z } from "zod";

export const variantStrategySchema = z.object({
  id: z.enum(["A", "B", "C"]),
  title: z.string(),
  goal: z.string(),
  emphasis: z.array(z.string()).min(1),
  avoid: z.array(z.string()).default([]),
  bestFor: z.string(),
  risk: z.string(),
});

export const variantStrategyPlanSchema = z.object({
  chapterFunction: z.enum([
    "plot_advance",
    "emotional_fallout",
    "relationship_turn",
    "mystery_reveal",
    "misdirection",
    "action_setpiece",
    "worldbuilding_discovery",
    "transition",
    "climax_setup",
    "aftermath",
    "reversal",
    "setup",
    "payoff",
    "other",
  ]),
  riskLevel: z.enum(["low", "medium", "high"]),
  variantCount: z.number().int().min(1).max(3),
  rationale: z.string(),
  rhythmConsideration: z.string(),
  strategies: z.array(variantStrategySchema).min(1).max(3),
});

export type VariantStrategy = z.infer<typeof variantStrategySchema>;
export type VariantStrategyPlan = z.infer<typeof variantStrategyPlanSchema>;
