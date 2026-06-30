import { runArchivistForProject, runMuseForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import { finalChapters } from "@/schemas/final-manuscript";

import type { SelectedFinalArtifacts } from "./artifact-types";
import { CollapsibleProse } from "./collapsible-prose";
import { StagePanel } from "./stage-panel";

export function FinalSelectionPanel({ projectId, selectedFinalArtifacts }: { projectId: string; selectedFinalArtifacts: SelectedFinalArtifacts }) {
  return (
    <StagePanel count={selectedFinalArtifacts.length} empty="还没有选择终稿。选择一个润色变体来完成闸门 3。" title="已选终稿">
      {selectedFinalArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-500">已累计 {finalChapters(data).length} 章</p>
                  <p className="mt-2 text-xs text-doc-muted">最新章节：{data.title}</p>
                  <p className="mt-1 text-xs text-doc-muted">{data.selectionNote}</p>
                </div>
                <form action={runArchivistForProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="finalArtifactId" value={artifact.id} />
                  <SubmitButton
                    pendingText="生成补丁中..."
                    processHint={{
                      agent: "记忆管理员",
                      description: "读取已选终稿，提取需要写回角色、线索和设定记忆的变更。",
                      steps: ["读取已选终稿", "召回现有记忆", "请求大模型生成记忆补丁", "校验补丁目标", "保存待审核补丁并刷新工作台"],
                      title: "生成记忆补丁",
                    }}
                    className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    生成记忆补丁
                  </SubmitButton>
                </form>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[240px_1fr]">
                <nav className="rounded-xl border border-stone-200 bg-doc-card p-3">
                  <p className="text-xs font-medium text-doc-muted">章节列表</p>
                  <ol className="mt-3 space-y-2">
                    {finalChapters(data).map((chapter, index) => (
                      <li key={chapter.id}>
                        <a href={`#chapter-${chapter.id}`} className="block rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-doc-text transition hover:border-stone-400 hover:text-stone-900">
                          第 {index + 1} 章：{chapter.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
                  <p className="text-xs font-medium text-doc-muted">完整正文</p>
                  <div className="mt-4 space-y-5">
                    {finalChapters(data).map((chapter, index) => (
                      <section key={chapter.id} id={`chapter-${chapter.id}`} className="scroll-mt-6 rounded-xl border border-stone-200 bg-doc-card p-5 shadow-sm">
                        <div className="flex items-center gap-3 border-b border-stone-200 pb-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-base font-semibold text-stone-900">第 {index + 1} 章：{chapter.title}</p>
                            <p className="text-xs text-stone-400">{chapter.selectionNote}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <CollapsibleProse text={chapter.manuscript} fade="card" />
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-stone-300 bg-doc-card p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-900">继续写下一章</p>
                  <p className="mt-1 text-xs text-doc-muted">
                    下一章会自动承接「原始上文 + 已选 {finalChapters(data).length} 章」的完整正文，无需重新粘贴上文。点击后回到构思阶段生成新方向。
                  </p>
                </div>
                <form action={runMuseForProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <SubmitButton
                    pendingText="构思中..."
                    processHint={{
                      agent: "构思师",
                      description: "基于原始上文与已选章节的完整正文，构思下一章的续写方向。",
                      steps: ["拼接完整正文（上文 + 已选章节）", "召回项目记忆", "组织方向提示词", "请求大模型生成候选方向", "保存方向产物并刷新工作台"],
                      title: "构思下一章方向",
                    }}
                    className="shrink-0 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    继续写下一章
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取已选终稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
