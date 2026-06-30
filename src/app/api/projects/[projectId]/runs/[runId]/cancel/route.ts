import { NextResponse } from "next/server";

import { requestCancel } from "@/core/run-progress";

export const dynamic = "force-dynamic";

// 请求中止指定 run：向活跃任务发取消信号，进行中的模型请求会立即中断。
export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const { runId } = await params;
  const cancelled = requestCancel(runId);
  return NextResponse.json({ cancelled });
}
