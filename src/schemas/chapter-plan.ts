import { z } from "zod";

export const plannedChapterSchema = z.object({
  index: z.number().int().positive(),
  title: z.string(),
  brief: z.string(),
  focus: z.array(z.string()),
});

export const chapterPlanSchema = z.object({
  overallGoal: z.string(),
  chapters: z.array(plannedChapterSchema).min(1),
});

export type PlannedChapter = z.infer<typeof plannedChapterSchema>;
export type ChapterPlan = z.infer<typeof chapterPlanSchema>;
