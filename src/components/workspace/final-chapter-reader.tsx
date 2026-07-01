"use client";

import { useRef, useState } from "react";

import type { FinalChapter } from "@/schemas/final-manuscript";

import { CollapsibleProse } from "./collapsible-prose";

type ChapterAction = (formData: FormData) => void | Promise<void>;

/**
 * 终稿阅读区（客户端）：左侧章节列表，右侧仅显示【当前选中】的那一章正文。
 * 支持：阅读 / 编辑本章（改标题+正文）/ 在编辑态里划选一段交 AI 重写 / 删除本章。
 * 所有 server action 由 Server Component 以 prop 传入（遵守 RSC 边界）。
 */
export function FinalChapterReader({
  projectId,
  chapters,
  removeChapterAction,
  updateChapterAction,
  rewriteSpanAction,
}: {
  projectId: string;
  chapters: FinalChapter[];
  removeChapterAction: ChapterAction;
  updateChapterAction: ChapterAction;
  rewriteSpanAction: ChapterAction;
}) {
  const [activeId, setActiveId] = useState<string>(() => chapters[0]?.id ?? "");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeIndex = chapters.findIndex((chapter) => chapter.id === activeId);
  const active = activeIndex >= 0 ? chapters[activeIndex] : chapters[0];
  const activeDisplayIndex = activeIndex >= 0 ? activeIndex : 0;

  if (chapters.length === 0 || !active) {
    return null;
  }

  const exitEditing = () => {
    setEditing(false);
    setRewriteOpen(false);
    setSelection(null);
  };

  const switchChapter = (id: string) => {
    setActiveId(id);
    exitEditing();
    setConfirmingId(null);
  };

  // 记录 textarea 当前选区（重写选中片段用偏移量，避免重复文本歧义）。
  const captureSelection = () => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setSelection(end > start ? { start, end } : null);
  };

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
                  onClick={() => switchChapter(chapter.id)}
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
            {!editing ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setConfirmingId(null);
                  }}
                  className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-900 hover:text-white"
                >
                  编辑本章
                </button>
                {confirmingId === active.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-red-500">确认删除？</span>
                    <form action={removeChapterAction}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="chapterId" value={active.id} />
                      <button type="submit" className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-600">
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
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(active.id)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 transition hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    删除本章
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={exitEditing}
                className="shrink-0 rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-stone-400"
              >
                取消编辑
              </button>
            )}
          </div>

          {!editing ? (
            <div className="mt-4">
              <CollapsibleProse key={active.id} text={active.manuscript} fade="card" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* 保存修改（改标题 + 全文） */}
              <form action={updateChapterAction} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="chapterId" value={active.id} />
                <label className="block text-xs font-medium text-doc-muted">
                  标题
                  <input
                    name="title"
                    defaultValue={active.title}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm text-doc-text outline-none transition focus:border-stone-400"
                  />
                </label>
                <label className="block text-xs font-medium text-doc-muted">
                  正文（可直接手改；或在下方选中一段交 AI 重写）
                  <textarea
                    ref={textareaRef}
                    name="manuscript"
                    defaultValue={active.manuscript}
                    rows={18}
                    onSelect={captureSelection}
                    onKeyUp={captureSelection}
                    onMouseUp={captureSelection}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 font-mono text-sm leading-6 text-doc-text outline-none transition focus:border-stone-400"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
                  >
                    保存修改
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      captureSelection();
                      setRewriteOpen((value) => !value);
                    }}
                    className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
                  >
                    重写选中…
                  </button>
                  <span className="text-xs text-doc-muted">
                    {selection ? `已选中 ${selection.end - selection.start} 字` : "未选中（先在正文里划选一段）"}
                  </span>
                </div>
              </form>

              {/* 重写选中片段（独立表单，带偏移量） */}
              {rewriteOpen ? (
                selection ? (
                  <form action={rewriteSpanAction} className="space-y-2 rounded-xl border border-stone-300 bg-stone-50 p-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="chapterId" value={active.id} />
                    <input type="hidden" name="selectionStart" value={selection.start} />
                    <input type="hidden" name="selectionEnd" value={selection.end} />
                    <p className="text-xs text-doc-muted">
                      将重写选中的 {selection.end - selection.start} 字（其余正文保持不变）。保存修改会覆盖此处未提交的手改，请先重写或先保存。
                    </p>
                    <textarea
                      name="instruction"
                      rows={2}
                      required
                      placeholder="例：把这段的对话改得更紧张，加入环境细节。"
                      className="w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-sm text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
                    >
                      重写选中片段
                    </button>
                  </form>
                ) : (
                  <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-xs text-doc-muted">
                    请先在上面的正文里用鼠标划选一段文字，再点「重写选中…」。
                  </p>
                )
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
