"use client";

import { useState } from "react";

import { ContextRail } from "./context-rail";
import { StageRail } from "./stage-rail";
import { defaultActiveStage, type StageKey, type StageStatus } from "./workspace-stage";

type ChapterPreview = {
  id: string;
  title: string;
  manuscript: string;
};

export type StageSlot = {
  key: StageKey;
  /** 中栏顶部操作条标题 */
  title: string;
  /** 操作条副标题 / 说明 */
  subtitle?: string;
  content: React.ReactNode;
};

export function WorkspaceLayout({
  projectId,
  stages,
  slots,
  chapters,
  manuscriptContext,
  manuscriptContextSlot,
  generationSlot,
  autopilotSlot,
}: {
  projectId: string;
  stages: StageStatus[];
  slots: StageSlot[];
  chapters: ChapterPreview[];
  manuscriptContext: string;
  manuscriptContextSlot: React.ReactNode;
  generationSlot: React.ReactNode;
  autopilotSlot?: React.ReactNode;
}) {
  const [activeStage, setActiveStage] = useState<StageKey>(() => defaultActiveStage(stages));

  const active = slots.find((slot) => slot.key === activeStage) ?? slots[0];
  const activeStatus = stages.find((stage) => stage.key === activeStage);

  return (
    <div className="space-y-4">
      {autopilotSlot ? (
        <details className="rounded-3xl border border-stone-800 bg-stone-900/70 p-2">
          <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-medium text-stone-200">
            <span className="text-amber-300">⚡ 自动续写</span>
            <span className="ml-2 text-xs text-stone-500">一次输入需求，自动跑完多章交付终稿（展开）</span>
          </summary>
          <div className="p-2">{autopilotSlot}</div>
        </details>
      ) : null}

      <section className="grid min-h-[680px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <StageRail stages={stages} activeStage={activeStage} onSelect={setActiveStage} />

      <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-stone-200 bg-doc-surface shadow-xl shadow-black/30">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-doc-surface/95 px-6 py-4 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.28em] text-doc-accent">
            {activeStatus ? `第 ${activeStatus.index} 步` : "工作流"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-doc-text">{active?.title ?? "工作台"}</h2>
          {active?.subtitle ? <p className="mt-1 text-sm text-doc-muted">{active.subtitle}</p> : null}
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-6 text-doc-text">{active?.content}</div>
      </section>

        <ContextRail
          projectId={projectId}
          chapters={chapters}
          manuscriptContext={manuscriptContext}
          manuscriptContextSlot={manuscriptContextSlot}
          generationSlot={generationSlot}
        />
      </section>
    </div>
  );
}
