import { runArchivistForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { SelectedFinalArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function FinalSelectionPanel({ projectId, selectedFinalArtifacts }: { projectId: string; selectedFinalArtifacts: SelectedFinalArtifacts }) {
  return (
    <StagePanel count={selectedFinalArtifacts.length} empty="还没有选择终稿。选择一个润色变体来完成闸门 3。" title="已选终稿">
      {selectedFinalArtifacts.slice(0, 3).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm text-green-300">{data.title}</p>
              <p className="mt-2 text-xs text-stone-500">{data.selectionNote}</p>
              <form action={runArchivistForProject} className="mt-3">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="finalArtifactId" value={artifact.id} />
                <SubmitButton pendingText="生成补丁中..." className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                  生成 Archivist 记忆补丁
                </SubmitButton>
              </form>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-800 bg-stone-950 p-3 text-sm leading-6 text-stone-300">
                {data.manuscript}
              </pre>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">无法读取已选终稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
