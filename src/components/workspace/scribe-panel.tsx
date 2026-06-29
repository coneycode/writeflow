import { runCriticForProject, runEditorForProject, updateDraftArtifact } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { DraftArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

function lines(items: string[]) {
  return items.join("\n");
}

export function ScribePanel({ draftArtifacts, projectId }: { draftArtifacts: DraftArtifacts; projectId: string }) {
  return (
    <StagePanel count={draftArtifacts.length} empty="还没有草稿。批准大纲后生成正文变体。" title="最新分段草稿">
      {draftArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <form action={updateDraftArtifact} className="space-y-4">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="draftArtifactId" value={artifact.id} />
                <label className="block text-sm text-stone-300">
                  大纲标题
                  <input name="outlineTitle" defaultValue={data.outlineTitle} className="mt-2 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-stone-100 outline-none focus:border-amber-300" />
                </label>

                <div className="grid gap-3">
                  {data.variants.map((variant) => (
                    <details key={variant.id} className="rounded-xl bg-stone-950 p-3" open>
                      <summary className="cursor-pointer text-sm font-medium text-stone-200">
                        变体 {variant.id}: {variant.title}
                      </summary>
                      <input type="hidden" name="variantId" value={variant.id} />

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="block text-xs text-stone-400">
                          变体标题
                          <input name="variantTitle" defaultValue={variant.title} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                        </label>
                        <label className="block text-xs text-stone-400">
                          策略
                          <input name="variantStrategy" defaultValue={variant.strategy} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                        </label>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="block text-xs text-stone-400">
                          优点（每行一条）
                          <textarea name="variantStrengths" defaultValue={lines(variant.strengths)} rows={3} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                        </label>
                        <label className="block text-xs text-stone-400">
                          风险（每行一条）
                          <textarea name="variantRisks" defaultValue={lines(variant.risks)} rows={3} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                        </label>
                      </div>

                      <div className="mt-3 space-y-3">
                        {variant.segments.map((segment) => (
                          <section key={`${variant.id}-${segment.sceneId}`} className="rounded-xl border border-stone-800 bg-stone-900 p-3">
                            <div className="grid gap-3 md:grid-cols-[100px_1fr]">
                              <label className="block text-xs text-stone-400">
                                场景 ID
                                <input name="segmentSceneId" defaultValue={segment.sceneId} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                              </label>
                              <label className="block text-xs text-stone-400">
                                场景标题
                                <input name="segmentSceneTitle" defaultValue={segment.sceneTitle} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                              </label>
                            </div>
                            <label className="mt-3 block text-xs text-stone-400">
                              分段正文
                              <textarea name="segmentManuscript" defaultValue={segment.manuscript} rows={12} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-3 text-sm leading-6 text-stone-100 outline-none focus:border-amber-300" />
                            </label>
                            <label className="mt-3 block text-xs text-stone-400">
                              分段备注（每行一条）
                              <textarea name="segmentNotes" defaultValue={lines(segment.notes)} rows={3} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-stone-100 outline-none focus:border-amber-300" />
                            </label>
                          </section>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>

                <label className="block text-sm text-stone-300">
                  编辑备注（每行一条）
                  <textarea name="notesForEditor" defaultValue={lines(data.notesForEditor)} rows={4} className="mt-2 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-stone-100 outline-none focus:border-amber-300" />
                </label>

                <SubmitButton pendingText="保存草稿中..." className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                  保存分段草稿修改
                </SubmitButton>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={runEditorForProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="draftArtifactId" value={artifact.id} />
                  <SubmitButton
                    pendingText="润色中..."
                    processHint={{
                      agent: "编辑智能体",
                      description: "读取分段草稿，整合成完整正文并生成润色变体。",
                      steps: ["读取分段草稿", "拼接完整正文", "召回风格记忆", "请求大模型润色", "保存润色稿并刷新工作台"],
                      title: "润色分段草稿",
                    }}
                    className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    运行编辑润色
                  </SubmitButton>
                </form>
                <form action={runCriticForProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="artifactId" value={artifact.id} />
                  <input type="hidden" name="artifactKind" value="draft" />
                  <SubmitButton
                    pendingText="审稿中..."
                    processHint={{
                      agent: "审稿智能体",
                      description: "检查草稿的连续性、人物动机、节奏和需要修改的问题。",
                      steps: ["读取草稿产物", "召回审稿记忆", "请求大模型审稿", "归纳问题严重级别", "保存审稿记录并刷新工作台"],
                      title: "审阅分段草稿",
                    }}
                    className="rounded-xl border border-red-300/60 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    运行审稿
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">无法读取草稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
