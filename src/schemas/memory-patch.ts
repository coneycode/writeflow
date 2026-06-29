import { z } from "zod";

export const memoryPatchChangeSchema = z.object({
  target: z.string(),
  operation: z.enum(["append", "update", "open_thread", "close_thread"]),
  content: z.string(),
  reason: z.string(),
  requiresApproval: z.boolean(),
});

export const finalManuscriptDigestSchema = z.object({
  chapterState: z.string(),
  keyEvents: z.array(z.string()),
  characterChanges: z.array(z.string()),
  threadChanges: z.array(z.string()),
  canonCandidates: z.array(z.string()),
  uncertainties: z.array(z.string()),
});

export const memoryPatchSchema = z.object({
  summary: z.string(),
  chapterState: z.string(),
  changes: z.array(memoryPatchChangeSchema),
  warnings: z.array(z.string()),
});

export type FinalManuscriptDigest = z.infer<typeof finalManuscriptDigestSchema>;
export type MemoryPatchChange = z.infer<typeof memoryPatchChangeSchema>;
export type MemoryPatch = z.infer<typeof memoryPatchSchema>;
