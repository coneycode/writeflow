import { z } from "zod";

export const beatSceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  pov: z.string().optional(),
  purpose: z.string(),
  conflict: z.string(),
  emotionalTurn: z.string(),
  informationReleased: z.array(z.string()),
  threadsAdvanced: z.array(z.string()),
  exitHook: z.string(),
});

export const beatSheetSchema = z.object({
  chapterTitle: z.string(),
  chapterGoal: z.string(),
  selectedDirection: z.string(),
  scenes: z.array(beatSceneSchema).min(1),
  continuityChecks: z.array(z.string()),
  risks: z.array(z.string()),
});

export type BeatScene = z.infer<typeof beatSceneSchema>;
export type BeatSheet = z.infer<typeof beatSheetSchema>;
