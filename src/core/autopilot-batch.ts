import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/lib/paths";
import type { PlannedChapter } from "@/schemas/chapter-plan";
import type { DraftSegment } from "@/schemas/draft";
import type { EditedSegment, EditedVariant } from "@/schemas/edit";
import type { VariantReview } from "@/schemas/review";

/** 审稿修订循环的断点：记录当前轮次与本轮已完成的逐变体审稿/修订，供续跑复用。 */
export type ReviewProgress = {
  round: number;
  /** 本轮被审 EditSet 的 artifactId（round>0 为修订版）。 */
  editArtifactId: string;
  /** 本轮已完成的逐变体审稿（key=variantId）。 */
  variantReviews?: Record<string, VariantReview>;
  /** 本轮已完成的逐变体修订（key=variantId）。 */
  revisedVariants?: Record<string, EditedVariant>;
};

/** 自动续跑的自动重试上限（间隔 60s，仅意外失败）。 */
export const AUTOPILOT_MAX_AUTO_RETRIES = 3;

/** 分批软闸门：每写满这么多章就停下等审阅（不是失败，是正常推进的暂停点）。 */
export const AUTOPILOT_GATE_INTERVAL = 5;
/** 到达软闸门后，若用户在这段时间内未操作则自动继续下一批（20 分钟）。 */
export const AUTOPILOT_GATE_AUTO_RESUME_MS = 20 * 60 * 1000;
/** 失败自动重试的排程延迟（前端定时器用，1 分钟）。 */
export const AUTOPILOT_FAILURE_AUTO_RESUME_MS = 60 * 1000;

/** 单章各阶段的断点：记录已完成阶段的 artifactId，续跑时读回复用。 */
export type ChapterCheckpoint = {
  globalIndex: number;
  directionArtifactId?: string;
  outlineArtifactId?: string;
  variantStrategyArtifactId?: string;
  draftArtifactId?: string;
  editArtifactId?: string;
  /**
   * 段级断点：整阶段落盘前，逐场累积已完成的 segment（key = 变体 id）。
   * 草稿/润色都是"变体 × 多场景"的循环，逐场落盘后失败续跑只补未完成的场，
   * 不重跑已生成的场景与变体。整阶段完成后会被清空（artifactId 已足够复用）。
   */
  draftSegments?: Record<string, DraftSegment[]>;
  editSegments?: Record<string, EditedSegment[]>;
  /** 审稿修订循环进度（续跑时从此轮/此变体接着走，不重审重修）。 */
  reviewProgress?: ReviewProgress;
  /** 本章已定稿并写入 selected_final 的章节 id（用于续跑补归档时定位正文）。 */
  finalizedChapterId?: string;
  /** 本章记忆是否已归档（定稿与归档之间中断时，续跑据此补归档）。 */
  archivedMemory?: boolean;
  status: "pending" | "completed" | "failed";
};

export type AutopilotFailureKind = "error" | "interrupted" | "quality" | "duplicate";

export type AutopilotDecisionOption = {
  id: "retry_from_checkpoint" | "regenerate_chapter" | "cancel_batch";
  label: string;
  description: string;
};

export type AutopilotRepairPlan = {
  level: "route" | "outline" | "draft_scene" | "edit_scene" | "review_only" | "memory" | "unknown";
  confidence: "high" | "medium" | "low";
  summary: string;
  recommendedAction: "rerun_review" | "revise_current_draft" | "regenerate_chapter" | "ask_author";
  rationale: string;
  affectedScenes?: string[];
  affectedVariants?: string[];
};

export type AutopilotFailureCategory = "recoverable" | "system_fix_required" | "author_decision_required" | "unknown";

export type AutopilotFailureDiagnosis = {
  title: string;
  summary: string;
  cause: string;
  impact: string;
  canRetryAsIs: boolean;
  recommendedAction: string;
  rawError?: string;
};

export type AutopilotFailureDecision = {
  title: string;
  summary: string;
  attempted: string[];
  whyNeedsDecision: string;
  issues: Array<{
    severity: "blocker" | "major" | "minor";
    problem: string;
    evidence?: string;
    suggestedFix?: string;
  }>;
  repairPlan?: AutopilotRepairPlan;
  options: AutopilotDecisionOption[];
};

export function classifyAutopilotFailureMessage(message: string): { category: AutopilotFailureCategory; diagnosis: AutopilotFailureDiagnosis } {
  const lower = message.toLowerCase();

  if (message.includes("Memory patch target is not allowed")) {
    const target = message.match(/Memory patch target is not allowed: ([^\n]+)/)?.[1]?.trim();
    const canNormalizeWorld = Boolean(target?.startsWith("memory/canon/world/") && target.endsWith(".md"));
    return {
      category: "system_fix_required",
      diagnosis: {
        title: "记忆归档目标未注册",
        summary: target ? `Archivist 试图写入未注册的记忆文件：${target}。` : "Archivist 试图写入未注册的记忆文件。",
        cause: "模型生成了当前记忆系统没有注册的目标路径。",
        impact: "正文与中间产物已保留，但记忆归档没有完成；如果没有目标映射修复，原样继续会再次失败。",
        canRetryAsIs: canNormalizeWorld,
        recommendedAction: canNormalizeWorld
          ? "当前版本会把 memory/canon/world/*.md 归并到 memory/canon/world.md，可应用映射后从断点继续。"
          : "需要先注册或映射该记忆目标，再继续自动续写。",
        rawError: message,
      },
    };
  }

  if (
    message.includes("Invalid input") ||
    lower.includes("expected") ||
    lower.includes("zod") ||
    lower.includes("did not contain a json object") ||
    lower.includes("does not contain a json object") ||
    lower.includes("no json object") ||
    lower.includes("invalid json") ||
    lower.includes("json parse")
  ) {
    return {
      category: "system_fix_required",
      diagnosis: {
        title: "模型输出格式与系统要求不匹配",
        summary: "某个智能体没有返回系统要求的 JSON 对象，或返回的数据没有通过结构校验。",
        cause: "模型输出不是可解析的 JSON，或缺字段、字段类型不符合当前 schema。",
        impact: "已完成阶段会保留；如果输出约束、解析容错或 schema 兼容没有修复，原样继续可能再次失败。",
        canRetryAsIs: false,
        recommendedAction: "先修复该智能体的输出约束、JSON 解析容错或 schema 兼容，再从断点继续。",
        rawError: message,
      },
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("network") || lower.includes("fetch failed") || lower.includes("econnreset") || lower.includes("etimedout") || message.includes("Run cancelled.")) {
    return {
      category: "recoverable",
      diagnosis: {
        title: "临时中断，可从断点恢复",
        summary: "系统判断这更像接口超时、网络中断或进程被中止。",
        cause: "外部请求或运行进程中断，不一定表示正文或配置有问题。",
        impact: "已完成章节与阶段断点已保留，继续时会跳过已完成阶段。",
        canRetryAsIs: true,
        recommendedAction: "可以直接从断点继续。",
        rawError: message,
      },
    };
  }

  return {
    category: "unknown",
    diagnosis: {
      title: "自动续写中断，系统无法可靠分类",
      summary: "这次错误没有匹配到已知的临时故障、schema 问题或记忆目标问题。",
      cause: "未知错误。",
      impact: "已完成章节与阶段断点已保留；但原样继续是否会再次失败尚不确定。",
      canRetryAsIs: false,
      recommendedAction: "建议暂停自动续写，先补充诊断或修复原因；不要让用户猜测错误类型。",
      rawError: message,
    },
  };
}

/** 一批自动续写的持久状态（一次只有一批，新批次覆盖）。 */
export type AutopilotBatch = {
  batchId: string;
  overallGoal: string;
  /** 全局编号的章节规划。 */
  plan: PlannedChapter[];
  priorChapterCountAtStart: number;
  /** gated = 已写满一批（GATE_INTERVAL 章）后的软停顿，等待审阅或超时自动续，非失败。 */
  status: "running" | "gated" | "failed" | "completed" | "cancelled";
  /** 已自动续跑次数（跨刷新持久，上限 AUTOPILOT_MAX_AUTO_RETRIES）。 */
  autoRetryCount: number;
  failure?: {
    globalIndex: number;
    kind: AutopilotFailureKind;
    category?: AutopilotFailureCategory;
    reason: string;
    diagnosis?: AutopilotFailureDiagnosis;
    repairPlan?: AutopilotRepairPlan;
    decision?: AutopilotFailureDecision;
  };
  /** key = globalIndex。 */
  checkpoints: Record<number, ChapterCheckpoint>;
};

function batchPath(projectId: string) {
  return path.join(projectRoot(projectId), "autopilot", "current.json");
}

export async function readBatch(projectId: string): Promise<AutopilotBatch | null> {
  try {
    const content = await fs.readFile(batchPath(projectId), "utf8");
    return JSON.parse(content) as AutopilotBatch;
  } catch {
    return null;
  }
}

export async function writeBatch(projectId: string, batch: AutopilotBatch): Promise<void> {
  const target = batchPath(projectId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(batch, null, 2), "utf8");
}

export async function clearBatch(projectId: string): Promise<void> {
  try {
    await fs.rm(batchPath(projectId));
  } catch {
    // 不存在：忽略。
  }
}

/**
 * 合并写入某章一个阶段的 artifactId（阶段成功后调用），使续跑能复用它。
 * 读取当前 batch，更新该章 checkpoint，落盘。batch 不存在则跳过（不应发生）。
 */
export async function saveChapterCheckpointStage(
  projectId: string,
  globalIndex: number,
  patch: Partial<Omit<ChapterCheckpoint, "globalIndex">>,
): Promise<void> {
  const batch = await readBatch(projectId);
  if (!batch) {
    return;
  }
  const existing: ChapterCheckpoint = batch.checkpoints[globalIndex] ?? { globalIndex, status: "pending" };
  batch.checkpoints[globalIndex] = { ...existing, ...patch, globalIndex };
  await writeBatch(projectId, batch);
}

/**
 * 逐场落盘：把某变体新完成的一个 segment 追加到该章的段级断点。
 * `phase` 区分草稿/润色。续跑时据此跳过已完成的场，只补未完成的。
 */
export async function appendChapterSegment(
  projectId: string,
  globalIndex: number,
  phase: "draft" | "edit",
  variantId: string,
  segment: DraftSegment | EditedSegment,
): Promise<void> {
  const batch = await readBatch(projectId);
  if (!batch) {
    return;
  }
  const checkpoint: ChapterCheckpoint = batch.checkpoints[globalIndex] ?? { globalIndex, status: "pending" };
  if (phase === "draft") {
    const map = { ...(checkpoint.draftSegments ?? {}) };
    map[variantId] = [...(map[variantId] ?? []), segment as DraftSegment];
    checkpoint.draftSegments = map;
  } else {
    const map = { ...(checkpoint.editSegments ?? {}) };
    map[variantId] = [...(map[variantId] ?? []), segment as EditedSegment];
    checkpoint.editSegments = map;
  }
  batch.checkpoints[globalIndex] = { ...checkpoint, globalIndex };
  await writeBatch(projectId, batch);
}

/** 阶段整体落盘后清掉段级中间态（artifactId 已能整段复用），保持 batch 精简。 */
export async function clearChapterSegments(
  projectId: string,
  globalIndex: number,
  phase: "draft" | "edit",
): Promise<void> {
  const batch = await readBatch(projectId);
  if (!batch) {
    return;
  }
  const checkpoint = batch.checkpoints[globalIndex];
  if (!checkpoint) {
    return;
  }
  if (phase === "draft") {
    delete checkpoint.draftSegments;
  } else {
    delete checkpoint.editSegments;
  }
  batch.checkpoints[globalIndex] = checkpoint;
  await writeBatch(projectId, batch);
}
