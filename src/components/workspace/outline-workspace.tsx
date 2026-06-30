"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import type { BeatSheet } from "@/schemas/beat-sheet";

function lines(items: string[]) {
  return items.join("\n");
}

function BulletList({ empty, items }: { empty: string; items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-doc-muted">{empty}</p>;
  }

  return (
    <ul className="space-y-2 text-sm leading-6 text-doc-text">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-900/80" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ReadOnlyOutline({ data }: { data: BeatSheet }) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-doc-accent">章节大纲</p>
        <h3 className="mt-3 text-2xl font-semibold text-doc-text">{data.chapterTitle}</h3>
        <p className="mt-3 text-sm leading-7 text-doc-text">{data.chapterGoal}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-doc-card p-4">
          <p className="text-xs font-medium text-doc-muted">已选方向</p>
          <p className="mt-2 text-sm leading-6 text-doc-text">{data.selectedDirection}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-doc-card p-4">
          <p className="text-xs font-medium text-doc-muted">连续性检查</p>
          <div className="mt-2">
            <BulletList empty="暂无连续性检查。" items={data.continuityChecks} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-semibold text-doc-text">场景节拍</h4>
          <span className="rounded-full border border-stone-300 px-3 py-1 text-xs text-doc-muted">共 {data.scenes.length} 场</span>
        </div>

        <div className="space-y-3">
          {data.scenes.map((scene, index) => (
            <article key={`${scene.id}-${index}`} className="rounded-2xl border border-stone-200 bg-doc-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs text-doc-accent">{scene.id} · 第 {index + 1} 场</p>
                  <h5 className="mt-1 text-lg font-semibold text-doc-text">{scene.title}</h5>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-doc-muted">
                  <span className="rounded-full bg-stone-100 px-3 py-1">地点：{scene.location}</span>
                  {scene.pov ? <span className="rounded-full bg-stone-100 px-3 py-1">视角：{scene.pov}</span> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-xs text-doc-muted">场景目的</p>
                  <p className="mt-2 text-sm leading-6 text-doc-text">{scene.purpose}</p>
                </div>
                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-xs text-doc-muted">冲突</p>
                  <p className="mt-2 text-sm leading-6 text-doc-text">{scene.conflict}</p>
                </div>
                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-xs text-doc-muted">情绪转折</p>
                  <p className="mt-2 text-sm leading-6 text-doc-text">{scene.emotionalTurn}</p>
                </div>
                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-xs text-doc-muted">出场钩子</p>
                  <p className="mt-2 text-sm leading-6 text-doc-text">{scene.exitHook}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-stone-200 p-3">
                  <p className="text-xs text-doc-muted">信息释放</p>
                  <div className="mt-2">
                    <BulletList empty="暂无信息释放。" items={scene.informationReleased} />
                  </div>
                </div>
                <div className="rounded-lg border border-stone-200 p-3">
                  <p className="text-xs text-doc-muted">线索推进</p>
                  <div className="mt-2">
                    <BulletList empty="暂无线索推进。" items={scene.threadsAdvanced} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-red-300/50 bg-red-50 p-4">
        <p className="text-xs font-medium text-red-700">风险提示</p>
        <div className="mt-2">
          <BulletList empty="暂无风险提示。" items={data.risks} />
        </div>
      </section>
    </div>
  );
}

type OutlineWorkspaceProps = {
  artifactId: string;
  data: BeatSheet;
  projectId: string;
  runScribeAction: (formData: FormData) => void | Promise<void>;
  updateOutlineAction: (formData: FormData) => void | Promise<void>;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-stone-300 bg-doc-card px-2 py-2 text-doc-text outline-none focus:border-stone-400";
const labelClass = "block text-xs text-doc-muted";

function EditableOutline({ artifactId, data, projectId, updateOutlineAction }: Pick<OutlineWorkspaceProps, "artifactId" | "data" | "projectId" | "updateOutlineAction">) {
  return (
    <form action={updateOutlineAction} className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="outlineArtifactId" value={artifactId} />

      <label className="block text-sm text-doc-text">
        章节标题
        <input name="chapterTitle" defaultValue={data.chapterTitle} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
      </label>

      <label className="block text-sm text-doc-text">
        章节目标
        <textarea name="chapterGoal" defaultValue={data.chapterGoal} rows={3} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
      </label>

      <label className="block text-sm text-doc-text">
        已选方向
        <textarea name="selectedDirection" defaultValue={data.selectedDirection} rows={3} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
      </label>

      <div className="space-y-3">
        {data.scenes.map((scene, index) => (
          <section key={`${scene.id}-${index}`} className="rounded-2xl border border-stone-200 bg-doc-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-doc-text">场景 {index + 1}</p>
              <span className="text-xs text-doc-muted">{scene.id}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[90px_1fr]">
              <label className={labelClass}>
                ID
                <input name="sceneId" defaultValue={scene.id} className={inputClass} />
              </label>
              <label className={labelClass}>
                场景标题
                <input name="sceneTitle" defaultValue={scene.title} className={inputClass} />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                地点
                <input name="sceneLocation" defaultValue={scene.location} className={inputClass} />
              </label>
              <label className={labelClass}>
                视角
                <input name="scenePov" defaultValue={scene.pov ?? ""} className={inputClass} />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                场景目的
                <textarea name="scenePurpose" defaultValue={scene.purpose} rows={3} className={inputClass} />
              </label>
              <label className={labelClass}>
                冲突
                <textarea name="sceneConflict" defaultValue={scene.conflict} rows={3} className={inputClass} />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                情绪转折
                <textarea name="sceneEmotionalTurn" defaultValue={scene.emotionalTurn} rows={3} className={inputClass} />
              </label>
              <label className={labelClass}>
                出场钩子
                <textarea name="sceneExitHook" defaultValue={scene.exitHook} rows={3} className={inputClass} />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                信息释放（每行一条）
                <textarea name="sceneInformationReleased" defaultValue={lines(scene.informationReleased)} rows={4} className={inputClass} />
              </label>
              <label className={labelClass}>
                线索推进（每行一条）
                <textarea name="sceneThreadsAdvanced" defaultValue={lines(scene.threadsAdvanced)} rows={4} className={inputClass} />
              </label>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-doc-text">
          连续性检查（每行一条）
          <textarea name="continuityChecks" defaultValue={lines(data.continuityChecks)} rows={4} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
        </label>
        <label className="block text-sm text-doc-text">
          风险（每行一条）
          <textarea name="risks" defaultValue={lines(data.risks)} rows={4} className="mt-2 w-full rounded-lg border border-stone-300 bg-doc-card px-3 py-2 text-doc-text outline-none focus:border-stone-400" />
        </label>
      </div>

      <SubmitButton pendingText="保存大纲中..." className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
        保存大纲修改
      </SubmitButton>
    </form>
  );
}

export function OutlineWorkspace({ artifactId, data, projectId, runScribeAction, updateOutlineAction }: OutlineWorkspaceProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-doc-card p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs text-doc-muted">默认只读，避免误改。需要调整节拍时再进入编辑模式。</p>
          <p className="mt-1 text-sm text-doc-text">当前模式：{isEditing ? "编辑" : "阅读"}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing((value) => !value)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white"
        >
          {isEditing ? "退出编辑" : "编辑大纲"}
        </button>
      </div>

      {isEditing ? <EditableOutline artifactId={artifactId} data={data} projectId={projectId} updateOutlineAction={updateOutlineAction} /> : <ReadOnlyOutline data={data} />}

      <form action={runScribeAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="outlineArtifactId" value={artifactId} />
        <SubmitButton
          pendingText="写稿中..."
          processHint={{
            agent: "写作智能体",
            description: "按照当前大纲逐场景续写正文，并生成可对比的分段草稿变体。",
            steps: ["读取当前大纲", "读取续写上文", "召回写作记忆", "请求大模型生成分段正文", "校验场景对应关系", "保存草稿产物并刷新工作台"],
            title: "生成分段正文",
          }}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          按当前大纲生成分段正文
        </SubmitButton>
      </form>
    </div>
  );
}
