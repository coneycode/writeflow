import { z } from "zod";

import { variantStrategySchema } from "./variant-strategy";

export const editedVariantSchema = z.object({
  id: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  editStrategy: z.string(),
  strategyPlan: variantStrategySchema.optional(),
  changesMade: z.array(z.string()),
  remainingConcerns: z.array(z.string()),
  manuscript: z.string(),
});

export const editedSegmentSchema = z.object({
  sceneId: z.string(),
  sceneTitle: z.string(),
  changesMade: z.array(z.string()),
  remainingConcerns: z.array(z.string()),
  manuscript: z.string(),
});

export const editSetSchema = z.object({
  sourceDraftTitle: z.string(),
  variants: z.array(editedVariantSchema).min(1),
  editorNotes: z.array(z.string()),
});

export const revisedVariantSchema = z.object({
  manuscript: z.string(),
  changesMade: z.array(z.string()),
  remainingConcerns: z.array(z.string()),
});

export type EditedVariant = z.infer<typeof editedVariantSchema>;
export type EditedSegment = z.infer<typeof editedSegmentSchema>;
export type EditSet = z.infer<typeof editSetSchema>;
export type RevisedVariant = z.infer<typeof revisedVariantSchema>;
