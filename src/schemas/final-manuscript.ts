import { z } from "zod";

export const finalChapterSchema = z.object({
  id: z.string(),
  sourceArtifactId: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  manuscript: z.string(),
  selectionNote: z.string(),
  createdAt: z.string(),
});

export const finalManuscriptSchema = z.object({
  sourceArtifactId: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  manuscript: z.string(),
  selectionNote: z.string(),
  chapters: z.array(finalChapterSchema).min(1),
});

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
