import { z } from "zod";

import { finalVariantSelectionSchema } from "./final-selection";
import { variantStrategyPlanSchema } from "./variant-strategy";

export const finalSelectionRationaleSchema = z.object({
  strategyPlan: variantStrategyPlanSchema.optional(),
  finalSelection: finalVariantSelectionSchema,
});

export const finalChapterSchema = z.object({
  id: z.string(),
  sourceArtifactId: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  manuscript: z.string(),
  selectionNote: z.string(),
  createdAt: z.string(),
  /** 本章情节概要：定稿时生成一次并存下，供后续续写/拆章规划复用，避免每次重算。 */
  summary: z.string().optional(),
  selectionRationale: finalSelectionRationaleSchema.optional(),
});

/** 章节摘要 agent 的输出。 */
export const chapterSummarySchema = z.object({
  summary: z.string(),
});
export type ChapterSummary = z.infer<typeof chapterSummarySchema>;

export const finalManuscriptSchema = z.object({
  sourceArtifactId: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  manuscript: z.string(),
  selectionNote: z.string(),
  chapters: z.array(finalChapterSchema).min(1),
});

export type FinalSelectionRationale = z.infer<typeof finalSelectionRationaleSchema>;
export type FinalChapter = z.infer<typeof finalChapterSchema>;
export type FinalManuscript = z.infer<typeof finalManuscriptSchema>;

/** 兼容旧格式终稿：没有 chapters 字段时，把扁平字段合成为单章。 */
export function finalChapters(data: FinalManuscript): FinalChapter[] {
  return data.chapters?.length
    ? data.chapters
    : [
        {
          id: `${data.sourceArtifactId}-${data.sourceVariantId}`,
          sourceArtifactId: data.sourceArtifactId,
          sourceVariantId: data.sourceVariantId,
          title: data.title,
          manuscript: data.manuscript,
          selectionNote: data.selectionNote,
          createdAt: "",
        },
      ];
}
