import { NextResponse } from "next/server";

import { readRunState } from "@/core/run-progress";

export const dynamic = "force-dynamic";

// 轻量 JSON 端点：返回指定 run 的最新状态。供前端在 SSE 之外做轮询兜底，
// 避免长任务期间连接被中间层静默掐断后面板卡在“运行中”。
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const { projectId, runId } = await params;
  const state = await readRunState(projectId, runId);
  return NextResponse.json({ state });
}
