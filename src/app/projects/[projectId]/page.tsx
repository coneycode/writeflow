import { notFound } from "next/navigation";

import {
  getProject,
  listChapterPlanArtifacts,
  listDirectionArtifacts,
  listDraftArtifacts,
  listFinalArtifacts,
  listMemoryPatchArtifacts,
  listOutlineArtifacts,
  listReviewArtifacts,
  listSelectedFinalArtifacts,
  readProjectManuscriptContext,
  reviseFromReviewForProject,
  runAutopilotForProject,
} from "@/app/actions";
import { ArchitectPanel } from "@/components/workspace/architect-panel";
import { AutopilotPanel } from "@/components/workspace/autopilot-panel";
import { CriticPanel } from "@/components/workspace/critic-panel";
import { EditorPanel } from "@/components/workspace/editor-panel";
import { FinalSelectionPanel } from "@/components/workspace/final-selection-panel";
import { GenerationProcessPanel } from "@/components/workspace/generation-process-panel";
import { ManuscriptContextPanel } from "@/components/workspace/manuscript-context-panel";
import { MemoryPatchPanel } from "@/components/workspace/memory-patch-panel";
import { MusePanel } from "@/components/workspace/muse-panel";
import { ScribePanel } from "@/components/workspace/scribe-panel";
import { WorkspaceLayout, type StageSlot } from "@/components/workspace/workspace-layout";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { deriveStages, type StageKey } from "@/components/workspace/workspace-stage";
import { finalChapters } from "@/schemas/final-manuscript";

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
  const chapterPlanArtifacts = await listChapterPlanArtifacts(project.id);
  const manuscriptContext = await readProjectManuscriptContext(project.id);

  const contextReady = manuscriptContext.trim().length > 0;
  const done: Record<StageKey, boolean> = {
    muse: directionArtifacts.length > 0,
    architect: outlineArtifacts.length > 0,
    scribe: draftArtifacts.length > 0,
    editor: finalArtifacts.length > 0,
    critic: reviewArtifacts.length > 0,
    final: selectedFinalArtifacts.length > 0,
    archive: memoryPatchArtifacts.length > 0,
  };

  const stages = deriveStages(done, contextReady);

  const latestFinal = selectedFinalArtifacts[0]?.data ?? null;
  const chapters = (latestFinal ? finalChapters(latestFinal) : []).map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    manuscript: chapter.manuscript,
  }));

  const slots: StageSlot[] = [
    {
      key: "muse",
      title: "构思方向",
      subtitle: "读取上文与本地记忆，生成多个候选续写方向。",
      content: <MusePanel directionArtifacts={directionArtifacts} projectId={project.id} />,
    },
    {
      key: "architect",
      title: "章节大纲",
      subtitle: "把所选方向拆成章节目标与场景节拍，可阅读或编辑。",
      content: <ArchitectPanel outlineArtifacts={outlineArtifacts} projectId={project.id} />,
    },
    {
      key: "scribe",
      title: "分段写作",
      subtitle: "按大纲逐场景生成正文草稿变体。",
      content: <ScribePanel draftArtifacts={draftArtifacts} projectId={project.id} />,
    },
    {
      key: "editor",
      title: "编辑润色",
      subtitle: "按场景润色草稿，准备进入审稿与终稿选择。",
      content: <EditorPanel finalArtifacts={finalArtifacts} projectId={project.id} />,
    },
    {
      key: "critic",
      title: "审稿",
      subtitle: "对草稿或润色稿做对抗式审查，作为终稿选择的依据。",
      content: <CriticPanel reviewArtifacts={reviewArtifacts} reviseAction={reviseFromReviewForProject} />,
    },
    {
      key: "final",
      title: "终稿选择",
      subtitle: "选定润色变体作为本章终稿，累计进入全文。",
      content: <FinalSelectionPanel projectId={project.id} selectedFinalArtifacts={selectedFinalArtifacts} />,
    },
    {
      key: "archive",
      title: "记忆归档",
      subtitle: "从终稿提取记忆补丁，审批后写回本地记忆。",
      content: <MemoryPatchPanel memoryPatchArtifacts={memoryPatchArtifacts} projectId={project.id} />,
    },
  ];

  return (
    <WorkspaceShell project={project}>
      <WorkspaceLayout
        projectId={project.id}
        stages={stages}
        slots={slots}
        chapters={chapters}
        manuscriptContext={manuscriptContext}
        manuscriptContextSlot={<ManuscriptContextPanel content={manuscriptContext} projectId={project.id} variant="rail" />}
        generationSlot={<GenerationProcessPanel projectId={project.id} />}
        autopilotSlot={
          <AutopilotPanel
            projectId={project.id}
            chapterPlanArtifacts={chapterPlanArtifacts}
            runAutopilotAction={runAutopilotForProject}
          />
        }
      />
    </WorkspaceShell>
  );
}
