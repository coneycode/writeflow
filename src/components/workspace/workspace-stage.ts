export type StageKey =
  | "muse"
  | "architect"
  | "strategy"
  | "scribe"
  | "editor"
  | "critic"
  | "final"
  | "archive";

export type StageState = "done" | "current" | "locked";

export type StageStatus = {
  key: StageKey;
  /** 1-based 序号，用于左栏管线展示 */
  index: number;
  name: string;
  /** 一句话状态摘要 */
  summary: string;
  state: StageState;
};

export type StageMeta = {
  key: StageKey;
  name: string;
  /** 未完成时的提示 */
  todo: string;
  /** 已完成时的提示 */
  done: string;
};

export const STAGE_ORDER: StageMeta[] = [
  { key: "muse", name: "构思方向", todo: "运行构思师，生成候选续写方向。", done: "已生成续写方向，待选择。" },
  { key: "architect", name: "章节大纲", todo: "选择方向后生成章节节拍表。", done: "已生成章节大纲，可阅读或编辑。" },
  { key: "strategy", name: "候选策略", todo: "根据本章功能与近期节奏规划正文候选策略。", done: "已规划候选策略，可查看每个版本的用途。" },
  { key: "scribe", name: "分段写作", todo: "按候选策略与大纲逐场景生成正文草稿。", done: "已生成分段草稿，可调整。" },
  { key: "editor", name: "编辑润色", todo: "对草稿运行编辑润色。", done: "已生成润色稿。" },
  { key: "critic", name: "审稿", todo: "对草稿或润色稿运行审稿。", done: "已生成审稿记录。" },
  { key: "final", name: "终稿选择", todo: "从润色变体中选定终稿章节。", done: "已选定终稿章节。" },
  { key: "archive", name: "记忆归档", todo: "从终稿生成记忆补丁并应用。", done: "已生成记忆补丁。" },
];

/**
 * 由各阶段是否已有产物，派生整条管线的状态。
 * - done: 该阶段已有产物
 * - current: 第一个未完成、且前置阶段均已完成的阶段
 * - locked: 前置未完成
 *
 * 续写上文是全局输入（在右栏维护），不是工作流阶段。未填写时，
 * 第一步（构思）锁定并提示先去右栏保存上文。
 */
export function deriveStages(done: Record<StageKey, boolean>, contextReady: boolean): StageStatus[] {
  let currentAssigned = false;

  return STAGE_ORDER.map((meta, position) => {
    const isDone = done[meta.key];
    let state: StageState;

    if (isDone) {
      state = "done";
    } else if (!contextReady) {
      state = "locked";
    } else if (!currentAssigned) {
      state = "current";
      currentAssigned = true;
    } else {
      state = "locked";
    }

    const summary = !isDone && !contextReady && position === 0 ? "请先在右栏「续写上文」中粘贴并保存上文。" : isDone ? meta.done : meta.todo;

    return {
      key: meta.key,
      index: position + 1,
      name: meta.name,
      summary,
      state,
    };
  });
}

/** 默认聚焦阶段：最靠后的、已解锁（done 或 current）的阶段。 */
export function defaultActiveStage(stages: StageStatus[]): StageKey {
  const unlocked = stages.filter((stage) => stage.state !== "locked");
  const current = unlocked.find((stage) => stage.state === "current");
  if (current) {
    return current.key;
  }

  const last = unlocked.at(-1);
  return last?.key ?? STAGE_ORDER[0].key;
}
