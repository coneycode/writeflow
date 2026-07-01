import { applyMemoryPatchForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { MemoryPatchArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

const operationLabels: Record<string, string> = {
  append: "追加",
  update: "更新",
  open_thread: "开启线索",
  close_thread: "关闭线索",
};

export function MemoryPatchPanel({ memoryPatchArtifacts, projectId }: { memoryPatchArtifacts: MemoryPatchArtifacts; projectId: string }) {
  return (
    <StagePanel count={memoryPatchArtifacts.length} empty="还没有记忆补丁。先从已选终稿生成补丁。" title="记忆补丁">
      {memoryPatchArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-doc-accent">{data.summary}</p>
              <p className="mt-2 text-xs text-doc-muted">新状态： {data.chapterState}</p>
              {(data.changes ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-amber-600">这份补丁没有可应用的变更条目（可能是早期或不完整的产物）。</p>
              ) : null}
              <form action={applyMemoryPatchForProject} className="mt-3">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="memoryPatchArtifactId" value={artifact.id} />
                <SubmitButton pendingText="应用中..." className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                  应用已批准记忆补丁
                </SubmitButton>
              </form>
              <p className="mt-2 text-xs text-doc-muted">
                应用会追加线索变化，并替换“更新”类型目标。批准前请逐条检查。
              </p>
              <div className="mt-3 space-y-2">
                {(data.changes ?? []).map((change, index) => (
                  <div key={`${change.target}-${index}`} className="rounded-lg border border-stone-200 bg-doc-card p-3">
                    <p className="text-sm font-medium text-doc-text">{operationLabels[change.operation] ?? change.operation}: {change.target}</p>
                    <p className="mt-1 text-xs text-doc-muted">{change.content}</p>
                    <p className="mt-1 text-xs text-doc-muted">原因： {change.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取记忆补丁产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
