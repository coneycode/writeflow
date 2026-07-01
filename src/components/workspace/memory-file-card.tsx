"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { MarkdownView } from "@/components/markdown-view";

/**
 * 单个记忆文件卡片：默认阅读模式（渲染 Markdown），点"编辑"切到文本域。
 * 保存 action 由 Server 页面以 prop 传入，避免客户端直接 import server actions。
 */
export function MemoryFileCard({
  projectId,
  title,
  relativePath,
  help,
  content,
  saveAction,
}: {
  projectId: string;
  title: string;
  relativePath: string;
  help: string;
  content: string;
  saveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const hasContent = content.trim().length > 0;

  return (
    <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 font-mono text-xs text-stone-500">{relativePath}</p>
          <p className="mt-2 text-xs leading-5 text-stone-500">{help}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="shrink-0 rounded-full border border-stone-700 px-4 py-2 text-xs font-medium text-stone-300 transition hover:border-amber-300 hover:text-amber-200"
        >
          {editing ? "取消编辑" : "编辑"}
        </button>
      </div>

      {editing ? (
        <form action={saveAction} className="mt-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="target" value={relativePath} />
          <textarea
            name="content"
            defaultValue={content}
            rows={16}
            spellCheck={false}
            className="w-full rounded-2xl border border-stone-800 bg-stone-950 p-4 font-mono text-sm leading-6 text-stone-300 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
            placeholder="在这里写 Markdown 记忆..."
          />
          <div className="mt-3 flex justify-end">
            <SubmitButton
              pendingText="保存中..."
              className="rounded-full bg-amber-300 px-4 py-2 text-xs font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              保存
            </SubmitButton>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-4 text-sm text-stone-300">
          {hasContent ? (
            <MarkdownView content={content} />
          ) : (
            <p className="text-stone-600">（暂无内容，点「编辑」开始填写）</p>
          )}
        </div>
      )}
    </div>
  );
}
