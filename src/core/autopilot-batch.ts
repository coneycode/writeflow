import fs from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/lib/paths";
import type { PlannedChapter } from "@/schemas/chapter-plan";

/** 自动续跑的自动重试上限（间隔 60s，仅意外失败）。 */
export const AUTOPILOT_MAX_AUTO_RETRIES = 3;

/** 单章各阶段的断点：记录已完成阶段的 artifactId，续跑时读回复用。 */
export type ChapterCheckpoint = {
  globalIndex: number;
  directionArtifactId?: string;
  outlineArtifactId?: string;
  draftArtifactId?: string;
  editArtifactId?: string;
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
  status: "running" | "failed" | "completed" | "cancelled";
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
