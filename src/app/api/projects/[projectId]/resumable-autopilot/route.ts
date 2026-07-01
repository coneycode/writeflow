import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { AUTOPILOT_MAX_AUTO_RETRIES, readBatch } from "@/core/autopilot-batch";
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
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const batch = await readBatch(projectId);

  if (!batch || batch.status !== "failed") {
    return NextResponse.json({ resumable: false, autoEligible: false, autoRetriesLeft: 0, failure: null });
  }

  const finalized = await finalizedChapterCount(projectId);
  const hasRemaining = batch.plan.some((chapter) => chapter.index > finalized);
  const retriesLeft = Math.max(0, AUTOPILOT_MAX_AUTO_RETRIES - batch.autoRetryCount);
  const unexpected = batch.failure?.kind === "error" || batch.failure?.kind === "interrupted";

  return NextResponse.json({
    resumable: hasRemaining,
    autoEligible: hasRemaining && unexpected && retriesLeft > 0,
    autoRetriesLeft: retriesLeft,
    failure: batch.failure ?? null,
  });
}
