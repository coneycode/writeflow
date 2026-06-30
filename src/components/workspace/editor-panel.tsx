import { runCriticForProject, selectFinalVariantForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { FinalArtifacts } from "./artifact-types";
import { CollapsibleProse } from "./collapsible-prose";
import { StagePanel } from "./stage-panel";

export function EditorPanel({ finalArtifacts, projectId }: { finalArtifacts: FinalArtifacts; projectId: string }) {
  return (
    <StagePanel count={finalArtifacts.length} empty="还没有润色稿。先对草稿运行编辑智能体，为闸门 3 做准备。" title="最新润色稿">
      {finalArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-doc-accent">{data.sourceDraftTitle}</p>
              <form action={runCriticForProject} className="mt-3">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="artifactId" value={artifact.id} />
                <input type="hidden" name="artifactKind" value="edit" />
                <SubmitButton
                  pendingText="审稿中..."
                  processHint={{
                    agent: "审稿智能体",
                    description: "检查润色稿的完成度、连续性和是否适合作为终稿候选。",
                    steps: ["读取润色稿", "召回审稿记忆", "请求大模型审稿", "整理修改建议", "保存审稿记录并刷新工作台"],
                    title: "审阅润色稿",
                  }}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  对润色稿运行审稿
                </SubmitButton>
              </form>
              <div className="mt-3 grid gap-3">
                {data.variants.map((variant) => (
                  <details key={variant.id} className="rounded-xl border border-stone-200 bg-doc-card p-3">
                    <summary className="cursor-pointer text-sm font-medium text-doc-text">
                      {variant.id}: {variant.title}
                    </summary>
                    <p className="mt-2 text-xs text-doc-muted">编辑策略： {variant.editStrategy}</p>
                    <form action={selectFinalVariantForProject} className="mt-3">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="editArtifactId" value={artifact.id} />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <SubmitButton pendingText="选择中..." className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                        选为闸门 3 终稿
                      </SubmitButton>
                    </form>
                    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <CollapsibleProse text={variant.manuscript} className="doc-prose text-sm" fade="stone" />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取润色稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
