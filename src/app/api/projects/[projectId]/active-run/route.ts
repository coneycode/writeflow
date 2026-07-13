import { NextResponse } from "next/server";

import { findVisibleRun } from "@/core/run-progress";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const visible = await findVisibleRun(projectId);
  return NextResponse.json({ runId: visible?.runId ?? null, state: visible });
}
