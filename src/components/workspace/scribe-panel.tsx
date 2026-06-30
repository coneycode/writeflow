import { runCriticForProject, runEditorForProject, updateDraftArtifact } from "@/app/actions";

import type { DraftArtifacts } from "./artifact-types";
import { DraftWorkspace } from "./draft-workspace";
import { StagePanel } from "./stage-panel";

export function ScribePanel({ draftArtifacts, projectId }: { draftArtifacts: DraftArtifacts; projectId: string }) {
  return (
    <StagePanel count={draftArtifacts.length} empty="还没有草稿。批准大纲后生成正文变体。" title="最新分段草稿">
      {draftArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <DraftWorkspace
              artifactId={artifact.id}
              data={data}
              projectId={projectId}
              updateDraftAction={updateDraftArtifact}
              runEditorAction={runEditorForProject}
              runCriticAction={runCriticForProject}
            />
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取草稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
