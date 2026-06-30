import { NextResponse } from "next/server";

import { findActiveRun } from "@/core/run-progress";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const active = await findActiveRun(projectId);
  return NextResponse.json({ runId: active?.runId ?? null, state: active });
}
