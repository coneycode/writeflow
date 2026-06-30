import { runScribeForProject, updateOutlineArtifact } from "@/app/actions";

import type { OutlineArtifacts } from "./artifact-types";
import { OutlineWorkspace } from "./outline-workspace";
import { StagePanel } from "./stage-panel";

export function ArchitectPanel({ outlineArtifacts, projectId }: { outlineArtifacts: OutlineArtifacts; projectId: string }) {
  return (
    <StagePanel count={outlineArtifacts.length} empty="还没有大纲。选择一个方向来生成章节节拍表。" title="最新大纲">
      {outlineArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <OutlineWorkspace artifactId={artifact.id} data={data} projectId={projectId} runScribeAction={runScribeForProject} updateOutlineAction={updateOutlineArtifact} />
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取大纲产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
