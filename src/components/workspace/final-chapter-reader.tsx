"use client";

import { useState } from "react";

import type { FinalChapter } from "@/schemas/final-manuscript";

import { CollapsibleProse } from "./collapsible-prose";

/**
 * 终稿阅读区（客户端）：左侧章节列表，右侧仅显示【当前选中】的那一章正文。
 * 删除本章带二次确认，避免误操作。删除 action 由 Server Component 以 prop 传入。
 */
export function FinalChapterReader({
  projectId,
  chapters,
  removeChapterAction,
}: {
  projectId: string;
  chapters: FinalChapter[];
  removeChapterAction: (formData: FormData) => void | Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string>(() => chapters[0]?.id ?? "");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const activeIndex = chapters.findIndex((chapter) => chapter.id === activeId);
  const active = activeIndex >= 0 ? chapters[activeIndex] : chapters[0];
  const activeDisplayIndex = activeIndex >= 0 ? activeIndex : 0;

  if (chapters.length === 0 || !active) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[240px_1fr]">
      <nav className="rounded-xl border border-stone-200 bg-doc-card p-3">
        <p className="text-xs font-medium text-doc-muted">章节列表</p>
        <ol className="mt-3 space-y-2">
          {chapters.map((chapter, index) => {
            const isActive = chapter.id === active.id;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(chapter.id)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                    isActive
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-stone-50 text-doc-text hover:border-stone-400 hover:text-stone-900"
                  }`}
                >
                  第 {index + 1} 章：{chapter.title}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
        <p className="text-xs font-medium text-doc-muted">完整正文 · 当前第 {activeDisplayIndex + 1} 章</p>
        <section className="mt-4 rounded-xl border border-stone-200 bg-doc-card p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-stone-200 pb-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
              {activeDisplayIndex + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-stone-900">第 {activeDisplayIndex + 1} 章：{active.title}</p>
              <p className="text-xs text-stone-400">{active.selectionNote}</p>
            </div>
            {confirmingId === active.id ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-red-500">确认删除？</span>
                <form action={removeChapterAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="chapterId" value={active.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-600"
                  >
                    删除
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-stone-400"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(active.id)}
                className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 transition hover:border-red-400 hover:bg-red-50 hover:text-red-600"
              >
                删除本章
              </button>
            )}
          </div>
          <div className="mt-4">
            <CollapsibleProse key={active.id} text={active.manuscript} fade="card" />
          </div>
        </section>
      </div>
    </div>
  );
}
