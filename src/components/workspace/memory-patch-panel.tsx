import { applyMemoryPatchForProject, runContextArchivistForProject } from "@/app/actions";
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-stone-300 bg-doc-card p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-900">为前情归档</p>
          <p className="mt-1 text-xs text-doc-muted">
            把开篇「续写上文」里已发生的事实提炼成记忆补丁（尤其是 timeline 事件）。生成后照常人工审批再应用。
          </p>
        </div>
        <form action={runContextArchivistForProject}>
          <input type="hidden" name="projectId" value={projectId} />
          <SubmitButton
            pendingText="归档中..."
            processHint={{
              agent: "记忆管理员",
              description: "读取前情/上文，提炼可写入 timeline 与设定记忆的已成立事实。",
              steps: ["读取续写上文", "分块摘要前情", "召回现有记忆", "生成记忆补丁", "保存待审核补丁并刷新工作台"],
              title: "为前情生成记忆补丁",
            }}
            className="shrink-0 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            为前情归档
          </SubmitButton>
        </form>
      </div>

      <StagePanel count={memoryPatchArtifacts.length} empty="还没有记忆补丁。可先为前情归档，或从已选终稿生成补丁。" title="记忆补丁">
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
    </div>
  );
}
