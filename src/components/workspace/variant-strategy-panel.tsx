import type { VariantStrategyArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function VariantStrategyPanel({ strategyArtifacts }: { strategyArtifacts: VariantStrategyArtifacts }) {
  return (
    <StagePanel count={strategyArtifacts.length} empty="还没有候选策略。Autopilot 会在章节大纲后，根据本章功能与近期节奏规划 1-3 个正文候选策略。" title="最新候选策略">
      {strategyArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3 space-y-4 text-sm text-doc-text">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">章节功能</p>
                  <p className="mt-1 font-medium">{data.chapterFunction}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">风险等级</p>
                  <p className="mt-1 font-medium">{data.riskLevel} · {data.variantCount} 个候选</p>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">规划理由</p>
                <p className="mt-2 leading-6 text-stone-700">{data.rationale}</p>
                <p className="mt-2 leading-6 text-stone-500">{data.rhythmConsideration}</p>
              </div>

              <div className="space-y-3">
                {data.strategies.map((strategy) => (
                  <section key={strategy.id} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{strategy.id}</span>
                      <h4 className="font-semibold text-doc-text">{strategy.title}</h4>
                    </div>
                    <p className="mt-2 leading-6 text-stone-700">{strategy.goal}</p>
                    <dl className="mt-3 grid gap-3 text-xs text-stone-500 md:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-stone-600">适合用于</dt>
                        <dd className="mt-1 leading-5">{strategy.bestFor}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-stone-600">主要风险</dt>
                        <dd className="mt-1 leading-5">{strategy.risk}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {strategy.emphasis.map((item) => (
                        <span key={item} className="rounded-full border border-stone-200 px-2 py-1 text-xs text-stone-500">{item}</span>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取候选策略产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
