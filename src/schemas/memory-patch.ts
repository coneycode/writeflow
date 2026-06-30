import { z } from "zod";

const operationAliases: Record<string, "append" | "update" | "open_thread" | "close_thread"> = {
  replace: "update",
  overwrite: "update",
  set: "update",
  add: "append",
  create: "append",
  open: "open_thread",
  close: "close_thread",
};

export const memoryPatchChangeSchema = z.object({
  target: z.string(),
  // 模型有时返回 schema 外的近义枚举（如 "replace"），这里做归一化兜底，
  // 避免一个枚举差异让整个记忆补丁任务失败。
  operation: z.preprocess(
    (value) => (typeof value === "string" ? operationAliases[value] ?? value : value),
    z.enum(["append", "update", "open_thread", "close_thread"]),
  ),
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
