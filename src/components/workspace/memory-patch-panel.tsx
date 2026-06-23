import { applyMemoryPatchForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { MemoryPatchArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function MemoryPatchPanel({ memoryPatchArtifacts, projectId }: { memoryPatchArtifacts: MemoryPatchArtifacts; projectId: string }) {
  return (
    <StagePanel count={memoryPatchArtifacts.length} empty="No memory patches yet. Generate one from a selected final manuscript." title="Archivist memory patches">
      {memoryPatchArtifacts.slice(0, 3).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm text-amber-300">{data.summary}</p>
              <p className="mt-2 text-xs text-stone-500">New state: {data.chapterState}</p>
              <form action={applyMemoryPatchForProject} className="mt-3">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="memoryPatchArtifactId" value={artifact.id} />
                <SubmitButton pendingText="Applying..." className="rounded-xl border border-green-300/60 px-3 py-2 text-xs font-medium text-green-200 transition hover:bg-green-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                  Apply approved memory patch
                </SubmitButton>
              </form>
              <p className="mt-2 text-xs text-stone-500">
                Applying appends thread changes and replaces update targets. Review each proposed change before approving.
              </p>
              <div className="mt-3 space-y-2">
                {data.changes.map((change, index) => (
                  <div key={`${change.target}-${index}`} className="rounded-xl bg-stone-950 p-3">
                    <p className="text-sm font-medium text-stone-200">{change.operation}: {change.target}</p>
                    <p className="mt-1 text-xs text-stone-500">{change.content}</p>
                    <p className="mt-1 text-xs text-stone-500">Reason: {change.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Unable to read memory patch artifact.</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
