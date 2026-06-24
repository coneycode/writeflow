import { notFound } from "next/navigation";

import {
  getProject,
  listDirectionArtifacts,
  listDraftArtifacts,
  listFinalArtifacts,
  listMemoryPatchArtifacts,
  listOutlineArtifacts,
  listReviewArtifacts,
  listSelectedFinalArtifacts,
  readProjectManuscriptContext,
} from "@/app/actions";
import { AgentSidebar } from "@/components/workspace/agent-sidebar";
import { ArchitectPanel } from "@/components/workspace/architect-panel";
import { CriticPanel } from "@/components/workspace/critic-panel";
import { EditorPanel } from "@/components/workspace/editor-panel";
import { FinalSelectionPanel } from "@/components/workspace/final-selection-panel";
import { MemoryPatchPanel } from "@/components/workspace/memory-patch-panel";
import { MemorySidebar } from "@/components/workspace/memory-sidebar";
import { ManuscriptContextPanel } from "@/components/workspace/manuscript-context-panel";
import { MusePanel } from "@/components/workspace/muse-panel";
import { ScribePanel } from "@/components/workspace/scribe-panel";
import { WorkflowGates } from "@/components/workspace/workflow-gates";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default async function ProjectWorkspace({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const directionArtifacts = await listDirectionArtifacts(project.id);
  const outlineArtifacts = await listOutlineArtifacts(project.id);
  const draftArtifacts = await listDraftArtifacts(project.id);
  const finalArtifacts = await listFinalArtifacts(project.id);
  const reviewArtifacts = await listReviewArtifacts(project.id);
  const selectedFinalArtifacts = await listSelectedFinalArtifacts(project.id);
  const memoryPatchArtifacts = await listMemoryPatchArtifacts(project.id);
  const manuscriptContext = await readProjectManuscriptContext(project.id);

  return (
    <WorkspaceShell project={project}>
      <section className="grid min-h-[680px] gap-4 lg:grid-cols-[260px_1fr_300px]">
        <MemorySidebar />
        <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300">小说工作流</p>
              <h2 className="mt-2 text-2xl font-semibold">续写工作台</h2>
            </div>
            <button className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-medium text-stone-950 opacity-60" disabled>
              工作流即将可用
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <ManuscriptContextPanel content={manuscriptContext} projectId={project.id} />
            <MusePanel directionArtifacts={directionArtifacts} projectId={project.id} />
            <WorkflowGates />
            <ArchitectPanel outlineArtifacts={outlineArtifacts} projectId={project.id} />
            <ScribePanel draftArtifacts={draftArtifacts} projectId={project.id} />
            <EditorPanel finalArtifacts={finalArtifacts} projectId={project.id} />
            <FinalSelectionPanel projectId={project.id} selectedFinalArtifacts={selectedFinalArtifacts} />
            <MemoryPatchPanel memoryPatchArtifacts={memoryPatchArtifacts} projectId={project.id} />
            <CriticPanel reviewArtifacts={reviewArtifacts} />
          </div>
        </section>
        <AgentSidebar />
      </section>
    </WorkspaceShell>
  );
}
