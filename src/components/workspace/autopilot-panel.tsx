import { SubmitButton } from "@/components/forms/submit-button";

import type { ChapterPlanArtifacts } from "./artifact-types";

export function AutopilotPanel({
  projectId,
  chapterPlanArtifacts,
  runAutopilotAction,
}: {
  projectId: string;
  chapterPlanArtifacts: ChapterPlanArtifacts;
  runAutopilotAction: (formData: FormData) => void | Promise<void>;
}) {
  const latestPlan = chapterPlanArtifacts[0]?.data ?? null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-doc-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-doc-text">自动续写</h3>
        <p className="text-sm leading-6 text-doc-muted">
          给出整体目标和章数，模型会自动拆章、逐章走完构思→大纲→写作→润色→审稿→终稿→归档并交付。最多 10 章；某章审稿反复不过会停下并报告，已成章保留。
        </p>
      </div>

      <form action={runAutopilotAction} className="mt-4 space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block text-sm text-doc-text">
          整体目标
          <textarea
            name="overallGoal"
            rows={3}
            required
            placeholder="例：用三章把阿牛从军离镇推进到边关初战，埋下与旧识重逢的背叛线。"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
          />
        </label>

        <label className="block text-sm text-doc-text">
          章数
          <input
            name="chapterCount"
            type="number"
            min={1}
            max={10}
            defaultValue={3}
            className="mt-1 w-24 rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm text-doc-text outline-none transition focus:border-stone-400"
          />
        </label>

        <label className="block text-sm text-doc-text">
          逐章要点（每行一章，可留空让模型自行编排）
          <textarea
            name="perChapterBriefs"
            rows={4}
            placeholder={"第1章：阿牛在镇口集结，与云瑶错过道别\n第2章：\n第3章：边关初见旧识，埋背叛伏笔"}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm leading-6 text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
          />
        </label>

        <SubmitButton
          pendingText="自动续写中..."
          processHint={{
            agent: "自动续写",
            description: "拆章后逐章自动走完全流程并交付终稿。",
            steps: ["拆解章节规划", "逐章：构思→大纲→写作→润色→审稿", "审稿不过自动修订重审", "选终稿累计进全文", "自动应用记忆补丁"],
            title: "自动续写",
          }}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          开始自动续写
        </SubmitButton>
      </form>

      {latestPlan ? (
        <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-doc-accent">最新章节规划</p>
          <p className="mt-2 text-sm leading-6 text-doc-text">{latestPlan.overallGoal}</p>
          <ol className="mt-3 space-y-2">
            {latestPlan.chapters.map((chapter) => (
              <li key={chapter.index} className="rounded-lg border border-stone-200 bg-doc-card p-3">
                <p className="text-sm font-semibold text-stone-900">第 {chapter.index} 章：{chapter.title}</p>
                <p className="mt-1 text-sm leading-6 text-doc-text">{chapter.brief}</p>
                {chapter.focus.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {chapter.focus.map((item, index) => (
                      <li key={index} className="flex gap-2 text-xs text-doc-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-900/60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
