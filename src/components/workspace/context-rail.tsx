"use client";

import { useState } from "react";
import Link from "next/link";

type ChapterPreview = {
  id: string;
  title: string;
  manuscript: string;
};

const memoryLinks = [
  ["当前状态", "memory/progress/state.md"],
  ["开放线索", "memory/progress/open_threads.md"],
  ["世界设定", "memory/canon/world.md"],
  ["时间线", "memory/canon/timeline.md"],
  ["文风", "memory/style/voice.md"],
  ["禁忌", "memory/style/taboo.md"],
];

function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-stone-800 bg-stone-900/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span>
          <span className="text-sm font-medium text-stone-200">{title}</span>
          {hint ? <span className="mt-0.5 block text-xs text-stone-500">{hint}</span> : null}
        </span>
        <span className={`text-stone-500 transition ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open ? <div className="border-t border-stone-800 p-4">{children}</div> : null}
    </section>
  );
}

export function ContextRail({
  projectId,
  chapters,
  manuscriptContext,
  manuscriptContextSlot,
  generationSlot,
}: {
  projectId: string;
  chapters: ChapterPreview[];
  manuscriptContext: string;
  manuscriptContextSlot: React.ReactNode;
  generationSlot: React.ReactNode;
}) {
  const previousStory = manuscriptContext.trim();
  const hasFullText = previousStory.length > 0 || chapters.length > 0;
  return (
    <aside className="flex flex-col gap-3">
      <Section title="续写上文" hint="所有续写步骤的承接依据" defaultOpen>
        {manuscriptContextSlot}
      </Section>

      <Section title="记忆文件" hint="canon · 进度 · 文风">
        <div className="grid gap-2">
          {memoryLinks.map(([label, file]) => (
            <Link
              key={file}
              href={`/projects/${projectId}/memory`}
              className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2 text-xs text-stone-300 transition hover:border-amber-300/50 hover:text-amber-200"
            >
              <span>{label}</span>
              <span className="font-mono text-[10px] text-stone-600">{file.split("/").at(-1)}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="已写全文" hint={chapters.length > 0 ? `前情 + 已累计 ${chapters.length} 章` : previousStory ? "仅前情，尚未选定终稿" : "尚未填写上文"}>
        {!hasFullText ? (
          <p className="text-xs text-stone-500">填写续写上文、选定终稿后，这里会从前情一路汇总到最新章节，可从头通读。</p>
        ) : (
          <div className="space-y-3">
            {previousStory ? (
              <details className="rounded-xl border border-amber-300/30 bg-stone-950/60 p-3" open>
                <summary className="cursor-pointer text-xs font-medium text-amber-200">前情（续写上文）</summary>
                <p className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-6 text-stone-400">
                  {previousStory}
                </p>
              </details>
            ) : null}
            {chapters.map((chapter, index) => (
              <details key={chapter.id} className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                <summary className="cursor-pointer text-xs font-medium text-stone-300">
                  第 {index + 1} 章：{chapter.title}
                </summary>
                <p className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-6 text-stone-400">
                  {chapter.manuscript}
                </p>
              </details>
            ))}
          </div>
        )}
      </Section>

      <div key="generation-slot">{generationSlot}</div>
    </aside>
  );
}
