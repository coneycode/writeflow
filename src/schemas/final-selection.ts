import { z } from "zod";

export const finalVariantSelectionSchema = z.object({
  selectedVariantId: z.string(),
  selectedVariantTitle: z.string(),
  chapterFunction: z.string(),
  selectionReason: z.string(),
  rejectedReasons: z.array(z.object({
    variantId: z.string(),
    reason: z.string(),
  })),
  rhythmNote: z.string(),
  qualityRisks: z.array(z.string()).default([]),
  shouldReviseBeforeFinal: z.boolean().default(false),
  revisionFocus: z.array(z.string()).default([]),
});

export type FinalVariantSelection = z.infer<typeof finalVariantSelectionSchema>;
