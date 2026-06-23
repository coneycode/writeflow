import { runCriticForProject, runEditorForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { DraftArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function ScribePanel({ draftArtifacts, projectId }: { draftArtifacts: DraftArtifacts; projectId: string }) {
  return (
    <StagePanel count={draftArtifacts.length} empty="还没有草稿。批准 Architect 大纲后生成正文变体。" title="最新 Scribe 草稿">
      {draftArtifacts.slice(0, 3).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm text-amber-300">{data.outlineTitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={runEditorForProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="draftArtifactId" value={artifact.id} />
                  <SubmitButton pendingText="润色中..." className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                    运行 Editor 润色
                  </SubmitButton>
                </form>
                <form action={runCriticForProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="artifactId" value={artifact.id} />
                  <input type="hidden" name="artifactKind" value="draft" />
                  <SubmitButton pendingText="审稿中..." className="rounded-xl border border-red-300/60 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                    运行 Critic 审稿
                  </SubmitButton>
                </form>
              </div>
              <div className="mt-3 grid gap-3">
                {data.variants.map((variant) => (
                  <details key={variant.id} className="rounded-xl bg-stone-950 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-stone-200">
                      变体 {variant.id}: {variant.title}
                    </summary>
                    <p className="mt-2 text-xs text-stone-500">策略： {variant.strategy}</p>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-800 bg-stone-900 p-3 text-sm leading-6 text-stone-300">
                      {variant.manuscript}
                    </pre>
                  </details>
                ))}
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
