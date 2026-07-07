"use client";

import { SubmitButton } from "@/components/forms/submit-button";

/**
 * 「生成创作纲领」表单：给一段种子想法 → 策划 agent 起草前瞻记忆（覆盖写 blueprint.md）。
 * server action 由 Server 页面以 prop 传入（遵守 RSC 边界）。
 */
export function BlueprintGenerateForm({
  projectId,
  generateAction,
}: {
  projectId: string;
  generateAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={generateAction} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <h2 className="text-lg font-semibold">生成创作纲领</h2>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        写正文之前，先定意图与方向：整体目标、伏笔规划（只写意图）、人物弧线、关键设定、结局基调。
        生成的草案会写入下方「创作纲领」，可再手动编辑。
      </p>
      <input type="hidden" name="projectId" value={projectId} />
      <textarea
        name="seed"
        rows={4}
        placeholder="给一段种子想法（可留空，让模型基于续写上文与现有记忆起草）。例：想把阿牛从怯懦写到为救人赴死，云瑶线以错过收尾，基调悲怆。"
        className="mt-3 w-full rounded-2xl border border-stone-800 bg-stone-950 p-4 text-sm leading-6 text-stone-300 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
      />
      <div className="mt-3 flex justify-end">
        <SubmitButton
          pendingText="起草中..."
          processHint={{
            agent: "策划",
            description: "根据种子、续写上文与现有记忆起草创作纲领（前瞻记忆）。",
            steps: ["读取种子与上文", "召回现有记忆", "起草整体目标/伏笔/人物弧线/设定/结局", "写入创作纲领并刷新"],
            title: "生成创作纲领",
          }}
          className="rounded-full bg-amber-300 px-5 py-2 text-sm font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          生成创作纲领
        </SubmitButton>
      </div>
    </form>
  );
}
