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
  failure?: { globalIndex: number; kind: AutopilotFailureKind; reason: string };
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
