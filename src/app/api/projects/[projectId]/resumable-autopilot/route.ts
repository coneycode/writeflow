import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  AUTOPILOT_MAX_AUTO_RETRIES,
  AUTOPILOT_GATE_AUTO_RESUME_MS,
  AUTOPILOT_FAILURE_AUTO_RESUME_MS,
  classifyAutopilotFailureMessage,
  readBatch,
} from "@/core/autopilot-batch";
import { projectRoot } from "@/lib/paths";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** 读最新终稿的已定稿章数（判断 batch 是否还有未完成的计划章）。 */
async function finalizedChapterCount(projectId: string): Promise<number> {
  const rows = await db.select().from(schema.artifacts).where(eq(schema.artifacts.projectId, projectId));
  const finals = rows.filter((row) => row.kind === "selected_final").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const latest = finals[0];
  if (!latest) {
    return 0;
  }
  try {
    const content = await fs.readFile(path.join(projectRoot(projectId), latest.filePath), "utf8");
    const data = JSON.parse(content) as { chapters?: unknown[] };
    return Array.isArray(data.chapters) ? data.chapters.length : 0;
  } catch {
    return 0;
  }
}

/**
 * 续跑可见性：告诉前端当前 batch 是否可续、是否可自动续跑、还剩几次自动重试。
 * 两种可续场景：
 *  - gated：软闸门（每批停下），正常推进的暂停，可手动/超时 20 分钟自动续，不消耗重试次数。
 *  - failed：意外失败，可手动续；error/interrupted 且未超上限时 1 分钟自动重试。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const batch = await readBatch(projectId);

  const isPausedWithFailure = batch?.status === "cancelled" && Boolean(batch.failure);
  if (!batch || (batch.status !== "failed" && batch.status !== "gated" && !isPausedWithFailure)) {
    return NextResponse.json({ resumable: false, gated: false, autoEligible: false, autoRetriesLeft: 0, failure: null });
  }

  const finalized = await finalizedChapterCount(projectId);
  const hasRemaining = batch.plan.some((chapter) => chapter.index > finalized);
  const remaining = batch.plan.filter((chapter) => chapter.index > finalized).length;

  if (batch.status === "gated") {
    return NextResponse.json({
      resumable: hasRemaining,
      gated: true,
      autoEligible: hasRemaining,
      autoRetriesLeft: 0,
      autoResumeDelayMs: AUTOPILOT_GATE_AUTO_RESUME_MS,
      completedThrough: finalized,
      remaining,
      failure: null,
    });
  }

  const retriesLeft = Math.max(0, AUTOPILOT_MAX_AUTO_RETRIES - batch.autoRetryCount);
  const unexpected = batch.failure?.kind === "error" || batch.failure?.kind === "interrupted";
  const paused = batch.status === "cancelled";
  const fallbackDiagnosis = batch.failure && !batch.failure.diagnosis
    ? classifyAutopilotFailureMessage(batch.failure.reason)
    : null;
  const failure = batch.failure
    ? {
        ...batch.failure,
        category: batch.failure.category ?? (batch.failure.kind === "quality" || batch.failure.kind === "duplicate" ? "author_decision_required" : fallbackDiagnosis?.category),
        repairPlan: batch.failure.repairPlan ?? (batch.failure.kind === "quality" ? {
          level: "unknown" as const,
          confidence: "low" as const,
          summary: "旧版 batch 未保存阶段归因，无法可靠判断应回退到哪一层。",
          recommendedAction: "ask_author" as const,
          rationale: "建议先查看审稿问题；如无法定位，再选择重新生成本章或暂停。",
        } : undefined),
        diagnosis: batch.failure.diagnosis ?? fallbackDiagnosis?.diagnosis ?? {
          title: batch.failure.kind === "quality" ? "审稿未通过，需要选择下一步" : batch.failure.kind === "duplicate" ? "章节重复度过高，需要选择下一步" : "自动续写中断，系统无法可靠分类",
          summary: batch.failure.reason,
          cause: batch.failure.kind === "quality" ? "当前章节没有通过审稿；旧版 batch 未保存完整阶段归因。" : batch.failure.kind === "duplicate" ? "当前章节与已成章重复度过高，旧版 batch 未保存完整重复诊断。" : "未知错误。",
          impact: "已成章与已生成阶段都已保留。",
          canRetryAsIs: false,
          recommendedAction: batch.failure.kind === "quality" ? "建议先查看审稿问题并选择最小回退策略，不要默认整章重写。" : batch.failure.kind === "duplicate" ? "建议重新生成本章，或暂停后明确本章必须产生的新事件。" : "建议暂停自动续写，先补充诊断或修复原因。",
          rawError: batch.failure.reason,
        },
      }
    : null;
  const autoRecoverable = Boolean(failure?.diagnosis?.canRetryAsIs);
  const autoEligible = !paused && hasRemaining && retriesLeft > 0 && (unexpected || autoRecoverable);
  const autoResumeDelayMs = failure?.category === "system_fix_required" && autoRecoverable
    ? 0
    : AUTOPILOT_FAILURE_AUTO_RESUME_MS;

  return NextResponse.json({
    resumable: hasRemaining,
    gated: false,
    paused,
    autoEligible,
    autoRetriesLeft: retriesLeft,
    autoResumeDelayMs,
    completedThrough: finalized,
    remaining,
    failure,
  });
}
