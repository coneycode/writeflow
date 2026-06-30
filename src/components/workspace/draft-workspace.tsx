"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import type { DraftSet } from "@/schemas/draft";

import { CollapsibleProse } from "./collapsible-prose";

function lines(items: string[]) {
  return items.join("\n");
}

function BulletList({ empty, items }: { empty: string; items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-doc-muted">{empty}</p>;
  }

  return (
    <ul className="space-y-1.5 text-sm leading-6 text-doc-text">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-900/80" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const fieldClass =
  "mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-2 py-2 text-doc-text outline-none focus:border-stone-400";

function ReadOnlyDraft({ data }: { data: DraftSet }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-doc-accent">分段草稿</p>
        <h3 className="mt-2 text-xl font-semibold text-doc-text">{data.outlineTitle}</h3>
      </section>

      <div className="space-y-4">
        {data.variants.map((variant) => (
          <article key={variant.id} className="rounded-2xl border border-stone-200 bg-doc-card p-4">
            <div className="flex flex-col gap-2 border-b border-stone-200 pb-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs text-doc-accent">变体 {variant.id}</p>
                <h4 className="mt-1 text-lg font-semibold text-doc-text">{variant.title}</h4>
                <p className="mt-1 text-sm text-doc-muted">策略： {variant.strategy}</p>
              </div>
              <span className="rounded-full border border-stone-300 px-3 py-1 text-xs text-doc-muted">共 {variant.segments.length} 场</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="text-xs text-doc-muted">优点</p>
                <div className="mt-2">
                  <BulletList empty="暂无。" items={variant.strengths} />
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="text-xs text-doc-muted">风险</p>
                <div className="mt-2">
                  <BulletList empty="暂无。" items={variant.risks} />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {variant.segments.map((segment, index) => (
                <section key={`${variant.id}-${segment.sceneId}`} className="border-b border-stone-100 pb-4 last:border-b-0 last:pb-0">
                  <p className="text-sm font-semibold text-stone-900">
                    {segment.sceneId} · 第 {index + 1} 场：{segment.sceneTitle}
                  </p>
                  <div className="mt-2">
                    <CollapsibleProse text={segment.manuscript} fade="card" />
                  </div>
                  {segment.notes.length > 0 ? (
                    <div className="mt-3 rounded-lg bg-stone-50 p-3">
                      <p className="text-xs text-doc-muted">分段备注</p>
                      <div className="mt-1.5">
                        <BulletList empty="暂无。" items={segment.notes} />
                      </div>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>

      {data.notesForEditor.length > 0 ? (
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-medium text-doc-muted">给编辑的备注</p>
          <div className="mt-2">
            <BulletList empty="暂无。" items={data.notesForEditor} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EditableDraft({
  artifactId,
  data,
  projectId,
  updateDraftAction,
}: {
  artifactId: string;
  data: DraftSet;
  projectId: string;
  updateDraftAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={updateDraftAction} className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="draftArtifactId" value={artifactId} />
      <label className="block text-sm text-doc-text">
        大纲标题
        <input name="outlineTitle" defaultValue={data.outlineTitle} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
      </label>

      <div className="grid gap-3">
        {data.variants.map((variant) => (
          <details key={variant.id} className="rounded-xl border border-stone-200 bg-doc-card p-3" open>
            <summary className="cursor-pointer text-sm font-medium text-doc-text">
              变体 {variant.id}: {variant.title}
            </summary>
            <input type="hidden" name="variantId" value={variant.id} />

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-doc-muted">
                变体标题
                <input name="variantTitle" defaultValue={variant.title} className={fieldClass} />
              </label>
              <label className="block text-xs text-doc-muted">
                策略
                <input name="variantStrategy" defaultValue={variant.strategy} className={fieldClass} />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-doc-muted">
                优点（每行一条）
                <textarea name="variantStrengths" defaultValue={lines(variant.strengths)} rows={3} className={fieldClass} />
              </label>
              <label className="block text-xs text-doc-muted">
                风险（每行一条）
                <textarea name="variantRisks" defaultValue={lines(variant.risks)} rows={3} className={fieldClass} />
              </label>
            </div>

            <div className="mt-3 space-y-3">
              {variant.segments.map((segment) => (
                <section key={`${variant.id}-${segment.sceneId}`} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="grid gap-3 md:grid-cols-[100px_1fr]">
                    <label className="block text-xs text-doc-muted">
                      场景 ID
                      <input name="segmentSceneId" defaultValue={segment.sceneId} className={fieldClass} />
                    </label>
                    <label className="block text-xs text-doc-muted">
                      场景标题
                      <input name="segmentSceneTitle" defaultValue={segment.sceneTitle} className={fieldClass} />
                    </label>
                  </div>
                  <label className="mt-3 block text-xs text-doc-muted">
                    分段正文
                    <textarea name="segmentManuscript" defaultValue={segment.manuscript} rows={12} className="mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-3 text-sm leading-7 text-doc-text outline-none focus:border-stone-400" />
                  </label>
                  <label className="mt-3 block text-xs text-doc-muted">
                    分段备注（每行一条）
                    <textarea name="segmentNotes" defaultValue={lines(segment.notes)} rows={3} className={fieldClass} />
                  </label>
                </section>
              ))}
            </div>
          </details>
        ))}
      </div>

      <label className="block text-sm text-doc-text">
        编辑备注（每行一条）
        <textarea name="notesForEditor" defaultValue={lines(data.notesForEditor)} rows={4} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
      </label>

      <SubmitButton pendingText="保存草稿中..." className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
        保存分段草稿修改
      </SubmitButton>
    </form>
  );
}

type DraftWorkspaceProps = {
  artifactId: string;
  data: DraftSet;
  projectId: string;
  updateDraftAction: (formData: FormData) => void | Promise<void>;
  runEditorAction: (formData: FormData) => void | Promise<void>;
  runCriticAction: (formData: FormData) => void | Promise<void>;
};

export function DraftWorkspace({ artifactId, data, projectId, updateDraftAction, runEditorAction, runCriticAction }: DraftWorkspaceProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-doc-card p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs text-doc-muted">默认只读，方便通读正文。需要逐场修改时再进入编辑模式。</p>
          <p className="mt-1 text-sm text-doc-text">当前模式：{isEditing ? "编辑" : "阅读"}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing((value) => !value)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white"
        >
          {isEditing ? "退出编辑" : "编辑草稿"}
        </button>
      </div>

      {isEditing ? (
        <EditableDraft artifactId={artifactId} data={data} projectId={projectId} updateDraftAction={updateDraftAction} />
      ) : (
        <ReadOnlyDraft data={data} />
      )}

      <div className="flex flex-wrap gap-2">
        <form action={runEditorAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="draftArtifactId" value={artifactId} />
          <SubmitButton
            pendingText="润色中..."
            processHint={{
              agent: "编辑智能体",
              description: "读取分段草稿，整合成完整正文并生成润色变体。",
              steps: ["读取分段草稿", "拼接完整正文", "召回风格记忆", "请求大模型润色", "保存润色稿并刷新工作台"],
              title: "润色分段草稿",
            }}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            运行编辑润色
          </SubmitButton>
        </form>
        <form action={runCriticAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="artifactId" value={artifactId} />
          <input type="hidden" name="artifactKind" value="draft" />
          <SubmitButton
            pendingText="审稿中..."
            processHint={{
              agent: "审稿智能体",
              description: "检查草稿的连续性、人物动机、节奏和需要修改的问题。",
              steps: ["读取草稿产物", "召回审稿记忆", "请求大模型审稿", "归纳问题严重级别", "保存审稿记录并刷新工作台"],
              title: "审阅分段草稿",
            }}
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            运行审稿
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
