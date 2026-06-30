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
  /** 触发本次构思时用户输入的说明（构思记录）。旧产物可能没有此字段。 */
  brief: z.string().optional(),
});

export type DirectionOption = z.infer<typeof directionOptionSchema>;
export type DirectionSet = z.infer<typeof directionSetSchema>;
