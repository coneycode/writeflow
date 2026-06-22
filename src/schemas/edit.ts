import { z } from "zod";

export const editedVariantSchema = z.object({
  id: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  editStrategy: z.string(),
  changesMade: z.array(z.string()),
  remainingConcerns: z.array(z.string()),
  manuscript: z.string(),
});

export const editSetSchema = z.object({
  sourceDraftTitle: z.string(),
  variants: z.array(editedVariantSchema).min(1),
  editorNotes: z.array(z.string()),
});

export type EditedVariant = z.infer<typeof editedVariantSchema>;
export type EditSet = z.infer<typeof editSetSchema>;
