import { z } from "zod";

export const draftSegmentSchema = z.object({
  sceneId: z.string(),
  sceneTitle: z.string(),
  manuscript: z.string(),
  notes: z.array(z.string()).default([]),
});

export const draftVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  strategy: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  segments: z.array(draftSegmentSchema).min(1),
});

export const draftSetSchema = z.object({
  outlineTitle: z.string(),
  variants: z.array(draftVariantSchema).min(1),
  notesForEditor: z.array(z.string()),
});

export type DraftSegment = z.infer<typeof draftSegmentSchema>;
export type DraftVariant = z.infer<typeof draftVariantSchema>;
export type DraftSet = z.infer<typeof draftSetSchema>;

export function draftVariantManuscript(variant: DraftVariant) {
  return variant.segments.map((segment) => segment.manuscript.trim()).filter(Boolean).join("\n\n");
}
