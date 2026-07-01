import { NextResponse } from "next/server";

import { resumeAutopilotJob } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * 触发断点续跑。?auto=1 为系统自动重试（受上限约束），否则为手动续跑（重置计数）。
 * 供生成过程面板的「继续」按钮与自动重试调用。
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const url = new URL(request.url);
  const auto = url.searchParams.get("auto") === "1";
  try {
    const result = await resumeAutopilotJob(projectId, auto);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ started: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
