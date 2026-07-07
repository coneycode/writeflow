import { z } from "zod";

/**
 * 创作纲领（前瞻记忆）：写正文之前定的意图/方向，持久化后作为上下文传给写作各阶段。
 * 与「回顾记忆」（archivist 事后从正文提炼的 timeline/canon/…）互补。
 */
export const blueprintSchema = z.object({
  /** 整体目标 / 故事走向。 */
  overallGoal: z.string(),
  /** 伏笔规划：只写【意图】（为什么埋、想怎么用），不订死回收章节。 */
  foreshadowing: z.array(
    z.object({
      intent: z.string(),
    }),
  ),
  /** 主要人物弧线：从头到尾的转变方向。 */
  characterArcs: z.array(
    z.object({
      name: z.string(),
      arc: z.string(),
    }),
  ),
  /** 关键设定 / 世界观基线（写前确立、不可违背的硬设定）。 */
  keySettings: z.array(z.string()),
  /** 结局指向 / 基调。 */
  endingTone: z.string(),
});

export type Blueprint = z.infer<typeof blueprintSchema>;
