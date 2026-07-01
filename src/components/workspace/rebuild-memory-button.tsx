"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

/**
 * 「从章节重建记忆」入口，带二次确认（破坏性操作）。
 * server action 由 Server Component 以 prop 传入。
 */
export function RebuildMemoryButton({
  projectId,
  rebuildAction,
}: {
  projectId: string;
  rebuildAction: (formData: FormData) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
      >
        从章节重建记忆
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-amber-600">将清空机器写入的记忆并按章重建，确认？</span>
      <form action={rebuildAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <SubmitButton
          pendingText="重建中..."
          processHint={{
            agent: "记忆管理员",
            description: "清空机器写入的记忆块，前情归档后逐章重建 timeline 与设定记忆。",
            steps: ["清空各记忆文件的机器块", "归档前情", "逐章按章归档并打标记", "刷新记忆"],
            title: "从章节重建记忆",
          }}
          className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          确认重建
        </SubmitButton>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-400"
      >
        取消
      </button>
    </div>
  );
}
