import { runScribeForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { OutlineArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function ArchitectPanel({ outlineArtifacts, projectId }: { outlineArtifacts: OutlineArtifacts; projectId: string }) {
  return (
    <StagePanel count={outlineArtifacts.length} empty="还没有大纲。选择一个 Muse 方向来生成章节节拍表。" title="最新 Architect 大纲">
      {outlineArtifacts.slice(0, 3).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm text-amber-300">{data.chapterTitle}</p>
              <p className="mt-2 text-sm text-stone-300">{data.chapterGoal}</p>
              <form action={runScribeForProject} className="mt-3">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="outlineArtifactId" value={artifact.id} />
                <SubmitButton pendingText="写稿中..." className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                  Approve 闸门 2 and draft variants
                </SubmitButton>
              </form>
              <div className="mt-3 space-y-2">
                {data.scenes.map((scene) => (
                  <div key={scene.id} className="rounded-xl bg-stone-950 p-3">
                    <p className="text-sm font-medium text-stone-200">{scene.id}: {scene.title}</p>
                    <p className="mt-1 text-xs text-stone-500">{scene.purpose}</p>
                    <p className="mt-1 text-xs text-stone-500">出场钩子： {scene.exitHook}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">无法读取大纲产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
