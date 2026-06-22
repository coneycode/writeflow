import { z } from "zod";

export const memoryPatchChangeSchema = z.object({
  target: z.string(),
  operation: z.enum(["append", "update", "open_thread", "close_thread"]),
  content: z.string(),
  reason: z.string(),
  requiresApproval: z.boolean(),
});

export const memoryPatchSchema = z.object({
  summary: z.string(),
  chapterState: z.string(),
  changes: z.array(memoryPatchChangeSchema),
  warnings: z.array(z.string()),
});

export type MemoryPatchChange = z.infer<typeof memoryPatchChangeSchema>;
export type MemoryPatch = z.infer<typeof memoryPatchSchema>;
