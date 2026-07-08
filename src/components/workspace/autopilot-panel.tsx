import { SubmitButton } from "@/components/forms/submit-button";

import type { ChapterPlanArtifacts } from "./artifact-types";

export function AutopilotPanel({
  projectId,
  chapterPlanArtifacts,
  runAutopilotAction,
  runFromPlanAction,
}: {
  projectId: string;
  chapterPlanArtifacts: ChapterPlanArtifacts;
  runAutopilotAction: (formData: FormData) => void | Promise<void>;
  runFromPlanAction: (formData: FormData) => void | Promise<void>;
}) {
  const latestPlan = chapterPlanArtifacts[0]?.data ?? null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-doc-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-doc-text">自动续写</h3>
        <p className="text-sm leading-6 text-doc-muted">
          先根据创作纲领生成续写路线图（<span className="font-medium text-doc-text">章数由故事决定</span>，非手填），审阅后点下方「基于此规划开写」分批推进。每写满 5 章会停下待审，20 分钟无操作则自动继续；某章审稿反复不过会停下并报告，已成章保留。
        </p>
      </div>

      <form action={runAutopilotAction} className="mt-4 space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block text-sm text-doc-text">
          本程聚焦目标（可留空，留空则完全依据创作纲领规划到结局）
          <textarea
            name="overallGoal"
            rows={3}
            placeholder="例：这一程侧重把阿牛从军离镇推进到边关初战，并埋下与旧识重逢的背叛线。留空则按创作纲领整体规划。"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
          />
        </label>

        <label className="block text-sm text-doc-text">
          开头几章要点（可选，每行一章；仅约束对应开头章，其余由模型规划到结局）
          <textarea
            name="perChapterBriefs"
            rows={3}
            placeholder={"第1章：阿牛在镇口集结，与云瑶错过道别\n第2章：\n第3章：边关初见旧识，埋背叛伏笔"}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm leading-6 text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
          />
        </label>

        <SubmitButton
          pendingText="生成路线图中..."
          processHint={{
            agent: "路线图规划",
            description: "根据创作纲领、续写上文与现有记忆，规划从当前进度到结局的整段路线图（章数由故事决定）。只生成规划，不立即开写。",
            steps: ["读取创作纲领与上文", "召回现有记忆与已成章", "自行判断到结局需多少章", "逐章规划推进要点", "生成路线图待审阅"],
            title: "生成续写路线图",
          }}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          生成续写路线图
        </SubmitButton>
      </form>

      {latestPlan ? (
        <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-doc-accent">续写路线图（共 {latestPlan.chapters.length} 章）</p>
            <form action={runFromPlanAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <SubmitButton
                pendingText="开写中..."
                processHint={{
                  agent: "自动续写",
                  description: "按此路线图逐章写完全流程；每写满 5 章停下待审，20 分钟无操作自动继续。",
                  steps: ["读取路线图", "跳过已定稿章", "逐章：构思→大纲→写作→润色→审稿", "选终稿累计进全文", "每 5 章停下待审/超时自动续"],
                  title: "基于路线图开写",
                }}
                className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                基于此规划开写
              </SubmitButton>
            </form>
          </div>
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
