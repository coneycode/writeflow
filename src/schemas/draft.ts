import { z } from "zod";

export const draftVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  strategy: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  manuscript: z.string(),
});

export const draftSetSchema = z.object({
  outlineTitle: z.string(),
  variants: z.array(draftVariantSchema).min(1),
  notesForEditor: z.array(z.string()),
});

export type DraftVariant = z.infer<typeof draftVariantSchema>;
export type DraftSet = z.infer<typeof draftSetSchema>;
