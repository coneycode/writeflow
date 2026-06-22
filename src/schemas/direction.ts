import { z } from "zod";

export const directionOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  coreMove: z.string(),
  whyNow: z.string(),
  affectedThreads: z.array(z.string()),
  characterPressure: z.array(z.string()),
  risks: z.array(z.string()),
  nextBeat: z.string(),
});

export const directionSetSchema = z.object({
  options: z.array(directionOptionSchema).min(1),
  recommendation: z.string(),
});

export type DirectionOption = z.infer<typeof directionOptionSchema>;
export type DirectionSet = z.infer<typeof directionSetSchema>;
