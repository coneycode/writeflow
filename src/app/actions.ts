import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { db, schema } from "@/db/client";
import { agents } from "@/agents/registry";
import { runAgent } from "@/core/agent-runner";
import { currentProgress, startJob } from "@/core/run-progress";
import { overwriteArtifact, readJsonArtifact, writeArtifact } from "@/core/artifact-store";
import { ensureDirectory, projectRoot, slugifyProjectName } from "@/lib/paths";
import { writeNovelProjectTemplate } from "@/memory/templates";
import { buildNovelRecallContext } from "@/memory/recall";
import { createProjectSchema } from "@/schemas/project";
import type { BeatSheet } from "@/schemas/beat-sheet";
import type { ChapterPlan, PlannedChapter } from "@/schemas/chapter-plan";
import type { DirectionOption, DirectionSet } from "@/schemas/direction";
import { draftSetSchema, draftVariantManuscript, type DraftSegment, type DraftSet, type DraftVariant } from "@/schemas/draft";
import type { EditedSegment, EditedVariant, EditSet, RevisedVariant } from "@/schemas/edit";
import type { CriticReview, ReviewIssue, VariantReview } from "@/schemas/review";
import { finalChapters } from "@/schemas/final-manuscript";
import type { FinalChapter, FinalManuscript } from "@/schemas/final-manuscript";
import { memoryPatchSchema } from "@/schemas/memory-patch";
import type { FinalManuscriptDigest, MemoryPatch } from "@/schemas/memory-patch";


const allowedMemoryTargets = [
  "memory/canon/world.md",
  "memory/canon/timeline.md",
  "memory/progress/state.md",
  "memory/progress/open_threads.md",
  "memory/style/voice.md",
  "memory/style/taboo.md",
];

function resolveMemoryTarget(rootPath: string, target: string) {
  const normalized = target.replace(/\\/g, "/").replace(/^\/+/, "");
  const isCharacterCard = normalized.startsWith("memory/canon/characters/") && normalized.endsWith(".md") && !normalized.includes("..");
  const isAllowedFile = allowedMemoryTargets.includes(normalized);

  if (!isAllowedFile && !isCharacterCard) {
    throw new Error(`Memory patch target is not allowed: ${target}`);
  }

  const resolved = path.resolve(rootPath, normalized);
  const memoryRoot = path.resolve(rootPath, "memory");
  if (!resolved.startsWith(memoryRoot + path.sep)) {
    throw new Error(`Memory patch target escapes project memory: ${target}`);
  }

  return { normalized, resolved };
}

async function applyMemoryPatchChange(rootPath: string, change: MemoryPatch["changes"][number]) {
  const { normalized, resolved } = resolveMemoryTarget(rootPath, change.target);
  await fs.mkdir(path.dirname(resolved), { recursive: true });

  const header = `

<!-- Writeflow memory patch: ${change.operation} -->
`;
  const body = `${header}${change.content.trim()}
`;

  if (change.operation === "append" || change.operation === "open_thread" || change.operation === "close_thread") {
    await fs.appendFile(resolved, body, "utf8");
    return `Appended patch content to ${normalized}`;
  }

  if (change.operation === "update") {
    await fs.writeFile(resolved, `${change.content.trim()}
`, "utf8");
    return `Replaced ${normalized}`;
  }

  throw new Error(`Unsupported memory patch operation: ${change.operation}`);
}


type WorkflowRunInput = {
  agentId?: string;
  artifactId?: string;
  currentStep: string;
  projectId: string;
  status?: "completed" | "failed";
  stepType: "agent" | "gate" | "system";
  summary: string;
  title: string;
  workflow?: string;
};

async function recordWorkflowRun(input: WorkflowRunInput) {
  const now = new Date();
  const runId = randomUUID();

  await db.insert(schema.runs).values({
    id: runId,
    projectId: input.projectId,
    workflow: input.workflow ?? "novel_continue",
    status: input.status ?? "completed",
    currentStep: input.currentStep,
    summary: input.summary,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.runSteps).values({
    id: randomUUID(),
    runId,
    agentId: input.agentId,
    stepType: input.stepType,
    title: input.title,
    status: input.status ?? "completed",
    artifactId: input.artifactId,
    createdAt: now,
    updatedAt: now,
  });

  return runId;
}

/**
 * 把生成产物写入磁盘，并关联到当前后台任务的 run。
 * 在 startJob 的 executor 内调用：run 行已由 startJob 建好，
 * 这里只补 run_steps 记录与 artifact 行，并标记项目更新时间。
 */
async function persistJobArtifact(input: {
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>;
  kind: typeof schema.artifacts.$inferInsert.kind;
  relativeDir: string;
  fileName: string;
  title: string;
  content: string;
  agentId?: string;
  stepType?: "agent" | "gate" | "system";
  stepTitle: string;
  summary: string;
  parentArtifactId?: string;
}) {
  const progress = currentProgress();
  const runId = progress?.runId;
  const now = new Date();
  const filePath = await writeArtifact(input.project.rootPath, input.relativeDir, input.fileName, input.content);
  const artifactId = randomUUID();

  if (runId) {
    await db.insert(schema.runSteps).values({
      id: randomUUID(),
      runId,
      agentId: input.agentId,
      stepType: input.stepType ?? "agent",
      title: input.stepTitle,
      status: "completed",
      artifactId,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: input.project.id,
    runId: runId ?? null,
    parentArtifactId: input.parentArtifactId ?? null,
    kind: input.kind,
    title: input.title,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, input.project.id));
  return artifactId;
}

export async function listProjects() {
  return db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt));
}

export async function listProjectRuns(projectId: string) {
  const rows = await db.select().from(schema.runs).where(eq(schema.runs.projectId, projectId)).orderBy(desc(schema.runs.createdAt));

  return Promise.all(
    rows.map(async (run) => ({
      run,
      steps: await db.select().from(schema.runSteps).where(eq(schema.runSteps.runId, run.id)).orderBy(desc(schema.runSteps.createdAt)),
      artifacts: await db.select().from(schema.artifacts).where(eq(schema.artifacts.runId, run.id)).orderBy(desc(schema.artifacts.createdAt)),
    })),
  );
}


export async function getProject(projectId: string) {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  return project ?? null;
}



function manuscriptContextPath(rootPath: string) {
  return path.join(rootPath, "manuscript/context.md");
}

export async function readProjectManuscriptContext(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return "";
  }

  try {
    return await fs.readFile(manuscriptContextPath(project.rootPath), "utf8");
  } catch {
    return "";
  }
}

function combineManuscriptContext(input: { chapters: FinalChapter[]; originalContext: string }) {
  return [
    input.originalContext.trim(),
    input.chapters
      .map((chapter, index) => `# 第 ${index + 1} 章：${chapter.title}\n\n${chapter.manuscript.trim()}`)
      .filter(Boolean)
      .join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function latestFinalChapters(project: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  const artifacts = await listProjectArtifacts(project.id, "selected_final");
  const [latestArtifact] = artifacts;
  if (!latestArtifact) {
    return [];
  }

  const finalManuscript = await readJsonArtifact<FinalManuscript>(project.rootPath, latestArtifact.filePath);
  if (!finalManuscript) {
    return [];
  }

  return finalManuscript.chapters?.length
    ? finalManuscript.chapters
    : [
        {
          id: `${finalManuscript.sourceArtifactId}-${finalManuscript.sourceVariantId}`,
          sourceArtifactId: finalManuscript.sourceArtifactId,
          sourceVariantId: finalManuscript.sourceVariantId,
          title: finalManuscript.title,
          manuscript: finalManuscript.manuscript,
          selectionNote: finalManuscript.selectionNote,
          createdAt: "",
        },
      ];
}

async function readProjectFullManuscriptContext(project: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  const originalContext = await readProjectManuscriptContext(project.id);
  const chapters = await latestFinalChapters(project);
  return combineManuscriptContext({ chapters, originalContext });
}

async function requireProjectManuscriptContext(project: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  const content = (await readProjectFullManuscriptContext(project)).trim();
  if (!content) {
    throw new Error("续写必须基于上文。请先在工作台的“续写上文”区域粘贴并保存文章上文。");
  }
  return content;
}

export async function updateProjectManuscriptContext(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const content = String(formData.get("content") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const target = manuscriptContextPath(project.rootPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
}

export async function updateProjectMemoryFile(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const target = String(formData.get("target") ?? "");
  const content = String(formData.get("content") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const { resolved } = resolveMemoryTarget(project.rootPath, target);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, "utf8");

  await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/memory`);
}

export async function listProjectArtifacts(projectId: string, kind?: "direction" | "outline" | "draft" | "edit" | "review" | "selected_final" | "memory_patch" | "chapter_plan") {
  const rows = await db.select().from(schema.artifacts).where(eq(schema.artifacts.projectId, projectId)).orderBy(desc(schema.artifacts.createdAt));
  return kind ? rows.filter((artifact) => artifact.kind === kind) : rows;
}

export async function listDirectionArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "direction");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<DirectionSet>(project.rootPath, artifact.filePath),
    })),
  );
}

export async function listOutlineArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "outline");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<BeatSheet>(project.rootPath, artifact.filePath),
    })),
  );
}

export async function listDraftArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "draft");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<DraftSet>(project.rootPath, artifact.filePath),
    })),
  );
}

export async function listFinalArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "edit");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<EditSet>(project.rootPath, artifact.filePath),
    })),
  );
}

export async function listReviewArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "review");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<CriticReview>(project.rootPath, artifact.filePath),
    })),
  );
}

export async function listSelectedFinalArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "selected_final");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<FinalManuscript>(project.rootPath, artifact.filePath),
    })),
  );
}

export async function listMemoryPatchArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "memory_patch");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<MemoryPatch>(project.rootPath, artifact.filePath, memoryPatchSchema),
    })),
  );
}

export async function listChapterPlanArtifacts(projectId: string) {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const artifacts = await listProjectArtifacts(projectId, "chapter_plan");
  return Promise.all(
    artifacts.map(async (artifact) => ({
      artifact,
      data: await readJsonArtifact<ChapterPlan>(project.rootPath, artifact.filePath),
    })),
  );
}

type ArtifactRow = typeof schema.artifacts.$inferSelect;

export type ChapterArchiveReview = {
  title: string;
  data: CriticReview | null;
};

export type ChapterArchive = {
  index: number;
  chapterId: string;
  title: string;
  selectionNote: string;
  manuscript: string;
  direction: { option: DirectionOption | null; recommendation: string } | null;
  outline: BeatSheet | null;
  draft: DraftSet | null;
  edit: EditSet | null;
  reviews: ChapterArchiveReview[];
};

async function getArtifactById(projectId: string, artifactId: string): Promise<ArtifactRow | null> {
  const [row] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, artifactId));
  return row && row.projectId === projectId ? row : null;
}

/**
 * 装配每章的完整谱系：以该章终稿锚定的 edit artifact 为起点，
 * 沿 parentArtifactId 回溯 edit → draft → outline → direction，
 * 并收集 parent 指向 edit/draft 的审稿记录。旧数据缺父链时各阶段为 null。
 */
export async function getChapterArchive(projectId: string): Promise<ChapterArchive[]> {
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const selectedFinals = await listProjectArtifacts(projectId, "selected_final");
  const [latest] = selectedFinals;
  if (!latest) {
    return [];
  }

  const finalManuscript = await readJsonArtifact<FinalManuscript>(project.rootPath, latest.filePath);
  if (!finalManuscript) {
    return [];
  }

  const chapters = finalChapters(finalManuscript);
  const reviewArtifacts = await listProjectArtifacts(projectId, "review");

  return Promise.all(
    chapters.map(async (chapter, index): Promise<ChapterArchive> => {
      const editArtifact = chapter.sourceArtifactId ? await getArtifactById(projectId, chapter.sourceArtifactId) : null;
      const edit = editArtifact ? await readJsonArtifact<EditSet>(project.rootPath, editArtifact.filePath) : null;

      const draftArtifact = editArtifact?.parentArtifactId ? await getArtifactById(projectId, editArtifact.parentArtifactId) : null;
      const draft = draftArtifact ? await readJsonArtifact<DraftSet>(project.rootPath, draftArtifact.filePath) : null;

      const outlineArtifact = draftArtifact?.parentArtifactId ? await getArtifactById(projectId, draftArtifact.parentArtifactId) : null;
      const outline = outlineArtifact ? await readJsonArtifact<BeatSheet>(project.rootPath, outlineArtifact.filePath) : null;

      const directionArtifact = outlineArtifact?.parentArtifactId ? await getArtifactById(projectId, outlineArtifact.parentArtifactId) : null;
      const directionSet = directionArtifact ? await readJsonArtifact<DirectionSet>(project.rootPath, directionArtifact.filePath) : null;
      const direction = directionSet
        ? {
            option: outline ? directionSet.options.find((option) => option.title === outline.selectedDirection || outline.selectedDirection.includes(option.title)) ?? null : null,
            recommendation: directionSet.recommendation,
          }
        : null;

      const relatedIds = new Set([editArtifact?.id, draftArtifact?.id].filter(Boolean) as string[]);
      const reviews = await Promise.all(
        reviewArtifacts
          .filter((artifact) => artifact.parentArtifactId && relatedIds.has(artifact.parentArtifactId))
          .map(async (artifact) => ({
            title: artifact.title,
            data: await readJsonArtifact<CriticReview>(project.rootPath, artifact.filePath),
          })),
      );

      return {
        index: index + 1,
        chapterId: chapter.id,
        title: chapter.title,
        selectionNote: chapter.selectionNote,
        manuscript: chapter.manuscript,
        direction,
        outline,
        draft,
        edit,
        reviews,
      };
    }),
  );
}

export async function createProject(formData: FormData) {
  "use server";

  const parsed = createProjectSchema.parse({
    name: formData.get("name"),
    type: formData.get("type") ?? "novel",
    description: formData.get("description") ?? "",
  });

  const id = randomUUID();
  const slug = `${slugifyProjectName(parsed.name)}-${id.slice(0, 8)}`;
  const rootPath = projectRoot(id);
  const now = new Date();

  await ensureDirectory(rootPath);
  if (parsed.type === "novel") {
    await writeNovelProjectTemplate(rootPath);
  }

  await db.insert(schema.projects).values({
    id,
    name: parsed.name,
    slug,
    type: parsed.type,
    description: parsed.description,
    rootPath,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function runMuseForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const brief = String(formData.get("brief") ?? "").trim();
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  // 同步校验上文存在，错误立即反馈到按钮；模型工作进入后台任务。
  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "muse",
    title: "生成续写方向",
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);
      const prompt = `Project: ${project.name}

续写上文（所有方向必须从这段上文的末尾自然延展，不得跳过当前场面）:
${manuscriptContextExcerpt(manuscriptContext)}

User brief:
${brief || "Generate three strong continuation directions from the current project memory."}

Project memory:
${recallExcerpt(recall)}

Return three options unless the brief asks otherwise.`;
      const result = await runAgent({ agent: agents.muse, prompt, maxTokens: 2200, label: "构思续写方向" });
      // 保存本次构思说明，作为可回看的构思记录。
      const directionSet = { ...result, brief };

      await persistJobArtifact({
        project,
        kind: "direction",
        relativeDir: "directions",
        fileName: "muse-directions",
        title: "Muse direction options",
        content: JSON.stringify(directionSet, null, 2),
        agentId: "muse",
        stepTitle: "Generate Muse directions",
        summary: "Muse generated story direction options.",
      });
    },
  });
}

export async function updateOutlineArtifact(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const outlineArtifactId = String(formData.get("outlineArtifactId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [outlineArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, outlineArtifactId));
  if (!outlineArtifact || outlineArtifact.projectId !== project.id || outlineArtifact.kind !== "outline") {
    throw new Error("Outline artifact not found.");
  }

  const sceneIds = formData.getAll("sceneId").map(String);
  const beatSheet: BeatSheet = {
    chapterTitle: String(formData.get("chapterTitle") ?? "").trim(),
    chapterGoal: String(formData.get("chapterGoal") ?? "").trim(),
    selectedDirection: String(formData.get("selectedDirection") ?? "").trim(),
    scenes: sceneIds.map((id, index) => ({
      id: id.trim(),
      title: String(formData.getAll("sceneTitle")[index] ?? "").trim(),
      location: String(formData.getAll("sceneLocation")[index] ?? "").trim(),
      pov: String(formData.getAll("scenePov")[index] ?? "").trim() || undefined,
      purpose: String(formData.getAll("scenePurpose")[index] ?? "").trim(),
      conflict: String(formData.getAll("sceneConflict")[index] ?? "").trim(),
      emotionalTurn: String(formData.getAll("sceneEmotionalTurn")[index] ?? "").trim(),
      informationReleased: String(formData.getAll("sceneInformationReleased")[index] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      threadsAdvanced: String(formData.getAll("sceneThreadsAdvanced")[index] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      exitHook: String(formData.getAll("sceneExitHook")[index] ?? "").trim(),
    })),
    continuityChecks: String(formData.get("continuityChecks") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
    risks: String(formData.get("risks") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
  };

  await overwriteArtifact(project.rootPath, outlineArtifact.filePath, JSON.stringify(beatSheet, null, 2));
  await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
}

async function runScribeSegment(input: {
  beatSheet: BeatSheet;
  manuscriptContext: string;
  nextSceneHint?: string;
  previousContext: string;
  projectName: string;
  recall: string;
  scene: BeatSheet["scenes"][number];
  variantId: "A" | "B";
  variantStrategy: string;
  label?: string;
}) {
  const prompt = `Project: ${input.projectName}

续写上文末尾（第一场必须直接承接，不得重述、跳场或改变 POV / 时态 / 文风）:
${manuscriptContextExcerpt(input.manuscriptContext)}

Chapter:
${input.beatSheet.chapterTitle}

Chapter goal:
${input.beatSheet.chapterGoal}

Variant request:
- id: ${input.variantId}
- strategy: ${input.variantStrategy}

Previous drafted context in this variant:
${tailText(input.previousContext, 1200)}

Current beat-sheet scene:
${JSON.stringify(input.scene, null, 2)}

Next scene hint:
${input.nextSceneHint ?? "无后续场景。"}

Project memory excerpt:
${recallExcerpt(input.recall)}

Write only the current scene segment. Keep sceneId and sceneTitle exactly aligned to the beat sheet.`;

  return runAgent({ agent: agents.scribeSegment, prompt, maxTokens: 2600, label: input.label });
}

async function runScribeVariant(input: {
  beatSheet: BeatSheet;
  manuscriptContext: string;
  projectName: string;
  recall: string;
  variantId: "A" | "B";
  variantStrategy: string;
}) {
  const segments: DraftSegment[] = [];
  const sceneTotal = input.beatSheet.scenes.length;

  for (const [sceneIndex, scene] of input.beatSheet.scenes.entries()) {
    const previousContext = segments.map((segment) => segment.manuscript).join("\n\n");
    const nextScene = input.beatSheet.scenes[sceneIndex + 1];
    const segment = await runScribeSegment({
      beatSheet: input.beatSheet,
      manuscriptContext: input.manuscriptContext,
      nextSceneHint: nextScene ? `${nextScene.id}: ${nextScene.title} — ${nextScene.purpose}` : undefined,
      previousContext,
      projectName: input.projectName,
      recall: input.recall,
      scene,
      variantId: input.variantId,
      variantStrategy: input.variantStrategy,
      label: `变体 ${input.variantId} · 第 ${sceneIndex + 1} 场 / 共 ${sceneTotal} 场：${scene.title}`,
    });
    segments.push(segment);
  }

  return {
    id: input.variantId,
    title: input.variantId === "A" ? "紧凑推进版" : "情绪压迫版",
    strategy: input.variantStrategy,
    strengths: ["按场景分段生成，降低长正文请求超时风险。"],
    risks: ["场景之间由分段上下文衔接，生成后需重点检查转场顺滑度。"],
    segments,
  } satisfies DraftVariant;
}

export async function runScribeForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const outlineArtifactId = String(formData.get("outlineArtifactId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [outlineArtifact] = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.id, outlineArtifactId));

  if (!outlineArtifact || outlineArtifact.projectId !== project.id || outlineArtifact.kind !== "outline") {
    throw new Error("Outline artifact not found.");
  }

  const beatSheet = await readJsonArtifact<BeatSheet>(project.rootPath, outlineArtifact.filePath);
  if (!beatSheet) {
    throw new Error("Unable to read outline artifact.");
  }

  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "scribe",
    title: "生成分段正文",
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);
      const variantRequests = [
        { id: "A" as const, strategy: "紧凑推进：强调悬念、行动压力和场景钩子。" },
        { id: "B" as const, strategy: "情绪压迫：强调人物感受、关系张力和细节余波。" },
      ];
      const variants: DraftVariant[] = [];

      for (const variantRequest of variantRequests) {
        const variant = await runScribeVariant({
          beatSheet,
          manuscriptContext,
          projectName: project.name,
          recall,
          variantId: variantRequest.id,
          variantStrategy: variantRequest.strategy,
        });
        variants.push(variant);
      }

      const result: DraftSet = {
        outlineTitle: beatSheet.chapterTitle,
        variants,
        notesForEditor: ["草稿已按变体拆分生成，以降低长正文请求超时风险。请重点检查两版之间的节奏差异和场景连续性。"],
      };

      await persistJobArtifact({
        project,
        kind: "draft",
        relativeDir: "drafts",
        fileName: "scribe-drafts",
        title: `Scribe drafts for ${beatSheet.chapterTitle}`,
        content: JSON.stringify(result, null, 2),
        agentId: "scribe",
        stepTitle: "Generate Scribe draft variants",
        summary: `Scribe generated draft variants for ${beatSheet.chapterTitle}.`,
        parentArtifactId: outlineArtifact.id,
      });
    },
  });
}

export async function runArchitectForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const directionArtifactId = String(formData.get("directionArtifactId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [directionArtifact] = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.id, directionArtifactId));

  if (!directionArtifact || directionArtifact.projectId !== project.id || directionArtifact.kind !== "direction") {
    throw new Error("Direction artifact not found.");
  }

  const directionSet = await readJsonArtifact<DirectionSet>(project.rootPath, directionArtifact.filePath);
  const selectedOption = directionSet?.options.find((option) => option.id === optionId);

  if (!selectedOption) {
    throw new Error("Selected direction option not found.");
  }

  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "architect",
    title: "生成章节大纲",
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);
      const prompt = `Project: ${project.name}

续写上文（章节大纲第一场必须承接这段上文的最后状态、地点、人物动作和情绪）:
${manuscriptContextExcerpt(manuscriptContext)}

Selected direction:
${JSON.stringify(selectedOption, null, 2)}

Full Muse recommendation:
${directionSet?.recommendation ?? ""}

Project memory:
${recallExcerpt(recall)}

Create a chapter beat sheet for this selected direction.`;
      const result = await runAgent({ agent: agents.architect, prompt, maxTokens: 2600, label: `生成大纲：方向 ${selectedOption.id}` });

      await persistJobArtifact({
        project,
        kind: "outline",
        relativeDir: "outlines",
        fileName: `outline-${selectedOption.id}`,
        title: `Architect outline for option ${selectedOption.id}`,
        content: JSON.stringify(result, null, 2),
        agentId: "architect",
        stepTitle: "Generate Architect outline",
        summary: `Architect generated an outline for option ${selectedOption.id}.`,
        parentArtifactId: directionArtifact.id,
      });
    },
  });
}

export async function updateDraftArtifact(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const draftArtifactId = String(formData.get("draftArtifactId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [draftArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, draftArtifactId));
  if (!draftArtifact || draftArtifact.projectId !== project.id || draftArtifact.kind !== "draft") {
    throw new Error("Draft artifact not found.");
  }

  const existingDraft = await readJsonArtifact<DraftSet>(project.rootPath, draftArtifact.filePath);
  if (!existingDraft) {
    throw new Error("Unable to read draft artifact.");
  }

  const variantIds = formData.getAll("variantId").map(String);
  let segmentCursor = 0;
  const draftSet = draftSetSchema.parse({
    outlineTitle: String(formData.get("outlineTitle") ?? "").trim(),
    notesForEditor: String(formData.get("notesForEditor") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
    variants: existingDraft.variants.map((variant, variantIndex) => {
      const segmentCount = variant.segments.length;
      const segmentIds = formData.getAll("segmentSceneId").map(String).slice(segmentCursor, segmentCursor + segmentCount);
      const segmentTitles = formData.getAll("segmentSceneTitle").map(String).slice(segmentCursor, segmentCursor + segmentCount);
      const segmentManuscripts = formData.getAll("segmentManuscript").map(String).slice(segmentCursor, segmentCursor + segmentCount);
      const segmentNotes = formData.getAll("segmentNotes").map(String).slice(segmentCursor, segmentCursor + segmentCount);
      segmentCursor += segmentCount;

      return {
        id: String(variantIds[variantIndex] ?? variant.id).trim(),
        title: String(formData.getAll("variantTitle")[variantIndex] ?? "").trim(),
        strategy: String(formData.getAll("variantStrategy")[variantIndex] ?? "").trim(),
        strengths: String(formData.getAll("variantStrengths")[variantIndex] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
        risks: String(formData.getAll("variantRisks")[variantIndex] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
        segments: variant.segments.map((segment, segmentIndex) => ({
          sceneId: String(segmentIds[segmentIndex] ?? segment.sceneId).trim(),
          sceneTitle: String(segmentTitles[segmentIndex] ?? segment.sceneTitle).trim(),
          manuscript: String(segmentManuscripts[segmentIndex] ?? "").trim(),
          notes: String(segmentNotes[segmentIndex] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
        })),
      };
    }),
  });

  await overwriteArtifact(project.rootPath, draftArtifact.filePath, JSON.stringify(draftSet, null, 2));
  await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
}

function tailText(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) {
    return value;
  }

  return value.slice(-maxCharacters);
}

function excerptText(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) {
    return value;
  }

  const half = Math.floor(maxCharacters / 2);
  return `${value.slice(0, half)}\n\n...（中间内容已省略以降低单次模型请求长度）...\n\n${value.slice(-half)}`;
}

function chunkText(value: string, maxCharacters: number) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += maxCharacters) {
    chunks.push(value.slice(index, index + maxCharacters));
  }
  return chunks.length > 0 ? chunks : [""];
}

function manuscriptContextExcerpt(value: string) {
  return tailText(value, 2400);
}

function recallExcerpt(value: string) {
  return excerptText(value, 3600);
}

function variantManuscriptForReview(variant: DraftVariant | EditedVariant) {
  if ("segments" in variant) {
    return variant.segments.map((segment) => `## ${segment.sceneId}: ${segment.sceneTitle}\n${segment.manuscript}`).join("\n\n");
  }

  return variant.manuscript;
}

async function runEditorSegment(input: {
  draftSetTitle: string;
  manuscriptContext: string;
  nextSceneHint?: string;
  previousContext: string;
  projectName: string;
  recall: string;
  segment: DraftVariant["segments"][number];
  variant: DraftVariant;
  label?: string;
}) {
  const prompt = `Project: ${input.projectName}

续写上文末尾（只用于保持承接，不要复述）:
${tailText(input.manuscriptContext, 1800)}

Draft set title:
${input.draftSetTitle}

Variant:
${JSON.stringify(
  {
    id: input.variant.id,
    title: input.variant.title,
    strategy: input.variant.strategy,
    risks: input.variant.risks,
  },
  null,
  2,
)}

Previous polished context in this variant:
${tailText(input.previousContext, 1200)}

Current scene segment to polish:
${JSON.stringify(input.segment, null, 2)}

Next scene hint:
${input.nextSceneHint ?? "无后续场景。"}

Project memory excerpt:
${tailText(input.recall, 2400)}

Polish only the current scene segment. Keep the same sceneId and sceneTitle. Return only the edited scene JSON.`;

  return runAgent({ agent: agents.editorSegment, prompt, maxTokens: 2200, label: input.label });
}

export async function runEditorForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const draftArtifactId = String(formData.get("draftArtifactId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [draftArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, draftArtifactId));
  if (!draftArtifact || draftArtifact.projectId !== project.id || draftArtifact.kind !== "draft") {
    throw new Error("Draft artifact not found.");
  }

  const draftSet = await readJsonArtifact<DraftSet>(project.rootPath, draftArtifact.filePath);
  if (!draftSet) {
    throw new Error("Unable to read draft artifact.");
  }

  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "editor",
    title: "润色分段草稿",
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);
      const variants: EditedVariant[] = [];

      for (const variant of draftSet.variants) {
        const editedSegments: EditedSegment[] = [];
        const sceneTotal = variant.segments.length;

        for (const [segmentIndex, segment] of variant.segments.entries()) {
          const previousContext = editedSegments.map((editedSegment) => editedSegment.manuscript).join("\n\n");
          const nextSegment = variant.segments[segmentIndex + 1];
          const editedSegment = await runEditorSegment({
            draftSetTitle: draftSet.outlineTitle,
            manuscriptContext,
            nextSceneHint: nextSegment ? `${nextSegment.sceneId}: ${nextSegment.sceneTitle} — ${nextSegment.manuscript.slice(0, 500)}` : undefined,
            previousContext,
            projectName: project.name,
            recall,
            segment,
            variant,
            label: `润色 变体 ${variant.id} · 第 ${segmentIndex + 1} 场 / 共 ${sceneTotal} 场：${segment.sceneTitle}`,
          });
          editedSegments.push(editedSegment);
        }

        variants.push({
          id: `${variant.id}-edited`,
          sourceVariantId: variant.id,
          title: `${variant.title}（润色版）`,
          editStrategy: `按场景分段润色，保持“${variant.strategy}”的变体策略。`,
          changesMade: editedSegments.flatMap((segment) => segment.changesMade.map((change) => `${segment.sceneId}: ${change}`)),
          remainingConcerns: editedSegments.flatMap((segment) => segment.remainingConcerns.map((concern) => `${segment.sceneId}: ${concern}`)),
          manuscript: editedSegments.map((segment) => segment.manuscript.trim()).filter(Boolean).join("\n\n"),
        });
      }

      const result: EditSet = {
        sourceDraftTitle: draftSet.outlineTitle,
        variants,
        editorNotes: ["润色已按场景分段执行，以降低长正文请求超时风险。请重点检查场景之间的衔接是否顺滑。"],
      };

      await persistJobArtifact({
        project,
        kind: "edit",
        relativeDir: "finals",
        fileName: "editor-polished-drafts",
        title: `Editor polished drafts for ${draftSet.outlineTitle}`,
        content: JSON.stringify(result, null, 2),
        agentId: "editor",
        stepTitle: "Polish draft variants",
        summary: `Editor polished drafts for ${draftSet.outlineTitle}.`,
        parentArtifactId: draftArtifact.id,
      });
    },
  });
}

function strongestVerdict(reviews: VariantReview[]) {
  if (reviews.some((review) => review.verdict === "reject")) {
    return "reject" as const;
  }

  if (reviews.some((review) => review.verdict === "revise")) {
    return "revise" as const;
  }

  return "pass" as const;
}

function reviewCandidates(source: DraftSet | EditSet) {
  return source.variants.map((variant) => ({
    id: variant.id,
    manuscript: variantManuscriptForReview(variant),
    title: variant.title,
  }));
}

async function runCriticVariantChunk(input: {
  artifactKind: string;
  chunk: string;
  chunkIndex: number;
  chunkTotal: number;
  manuscriptContext: string;
  projectName: string;
  recall: string;
  sourceTitle: string;
  variant: ReturnType<typeof reviewCandidates>[number];
}) {
  const prompt = `Project: ${input.projectName}

续写上文末尾（审稿必须检查是否承接此上文）:
${manuscriptContextExcerpt(input.manuscriptContext)}

Review source: ${input.sourceTitle}
Review source artifact kind: ${input.artifactKind}

Variant chunk to review:
${JSON.stringify(
  {
    chunkIndex: input.chunkIndex + 1,
    chunkTotal: input.chunkTotal,
    id: input.variant.id,
    manuscriptChunk: input.chunk,
    title: input.variant.title,
  },
  null,
  2,
)}

Project memory excerpt:
${recallExcerpt(input.recall)}

Critically review this chunk of a single variant for Gate 3 selection. Return only this variant chunk's review JSON.`;

  return runAgent({
    agent: agents.criticVariant,
    prompt,
    maxTokens: 1800,
    label: `审稿 变体 ${input.variant.id} · 块 ${input.chunkIndex + 1} / 共 ${input.chunkTotal}`,
  });
}

async function runCriticVariant(input: {
  artifactKind: string;
  manuscriptContext: string;
  projectName: string;
  recall: string;
  sourceTitle: string;
  variant: ReturnType<typeof reviewCandidates>[number];
}) {
  const chunks = chunkText(input.variant.manuscript, 4500);
  const chunkReviews: VariantReview[] = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const chunkReview = await runCriticVariantChunk({
      artifactKind: input.artifactKind,
      chunk,
      chunkIndex,
      chunkTotal: chunks.length,
      manuscriptContext: input.manuscriptContext,
      projectName: input.projectName,
      recall: input.recall,
      sourceTitle: input.sourceTitle,
      variant: input.variant,
    });
    chunkReviews.push(chunkReview);
  }

  return {
    variantId: input.variant.id,
    verdict: strongestVerdict(chunkReviews),
    summary: chunkReviews.map((review, index) => `片段 ${index + 1}: ${review.summary}`).join("\n"),
    issues: chunkReviews.flatMap((review) => review.issues),
  } satisfies VariantReview;
}

export async function runCriticForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  const artifactKind = String(formData.get("artifactKind") ?? "draft");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [sourceArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, artifactId));
  if (!sourceArtifact || sourceArtifact.projectId !== project.id || !["draft", "edit"].includes(sourceArtifact.kind)) {
    throw new Error("Review source artifact not found.");
  }

  const source = artifactKind === "edit"
    ? await readJsonArtifact<EditSet>(project.rootPath, sourceArtifact.filePath)
    : await readJsonArtifact<DraftSet>(project.rootPath, sourceArtifact.filePath);
  if (!source) {
    throw new Error("Unable to read review source artifact.");
  }

  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "critic",
    title: "审稿",
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);
      const reviews: VariantReview[] = [];
      const candidates = reviewCandidates(source);

      for (const candidate of candidates) {
        const review = await runCriticVariant({
          artifactKind,
          manuscriptContext,
          projectName: project.name,
          recall,
          sourceTitle: sourceArtifact.title,
          variant: candidate,
        });
        reviews.push(review);
      }

      const issueRank: Record<ReviewIssue["severity"], number> = { blocker: 3, major: 2, minor: 1 };
      const allIssues = reviews.flatMap((review) => review.issues).sort((left, right) => issueRank[right.severity] - issueRank[left.severity]);
      const passingReview = reviews.find((review) => review.verdict === "pass");
      const result: CriticReview = {
        verdict: strongestVerdict(reviews),
        summary: reviews.map((review) => `${review.variantId}: ${review.summary}`).join("\n"),
        issues: allIssues,
        strongestVariantId: passingReview?.variantId ?? reviews.sort((left, right) => left.issues.length - right.issues.length)[0]?.variantId,
        finalGateRecommendation: "审稿已按变体拆分执行。优先处理 blocker/major 问题；若存在 pass 变体，可作为终稿候选。",
      };

      await persistJobArtifact({
        project,
        kind: "review",
        relativeDir: "reviews",
        fileName: "critic-review",
        title: `Critic review for ${sourceArtifact.title}`,
        content: JSON.stringify(result, null, 2),
        agentId: "critic",
        stepTitle: "Run Critic review",
        summary: `Critic reviewed ${sourceArtifact.title}.`,
        parentArtifactId: sourceArtifact.id,
      });
    },
  });
}

function issuesForVariant(issues: ReviewIssue[], variantId: string) {
  // 无 variantId 的通用问题应用到所有被修订变体；其余按 variantId 匹配。
  return issues.filter((issue) => !issue.variantId || issue.variantId === variantId);
}

function formatIssuesForPrompt(issues: ReviewIssue[]) {
  return issues
    .map((issue, index) => `${index + 1}. [${issue.severity}] ${issue.problem}\n   位置：${issue.location ?? "未指明"}\n   证据：${issue.evidence}\n   建议：${issue.suggestedFix}`)
    .join("\n\n");
}

async function reviseVariantManuscript(input: {
  manuscriptContext: string;
  projectName: string;
  recall: string;
  variantId: string;
  variantTitle: string;
  manuscript: string;
  issues: ReviewIssue[];
}) {
  const prompt = `Project: ${input.projectName}

续写上文末尾（仅用于保持承接，不要复述）:
${tailText(input.manuscriptContext, 1800)}

Variant: ${input.variantId} — ${input.variantTitle}

需要修复的审稿问题（只修这些，其余内容尽量保持不变）:
${formatIssuesForPrompt(input.issues)}

待修订的完整正文:
${input.manuscript}

Project memory excerpt:
${recallExcerpt(input.recall)}

Revise the manuscript to resolve the listed issues. Return the complete revised variant JSON.`;

  return runAgent({ agent: agents.editorRevise, prompt, maxTokens: 4200, label: `修订 变体 ${input.variantId}` });
}

export async function reviseFromReviewForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const reviewArtifactId = String(formData.get("reviewArtifactId") ?? "");
  const issueIndexes = formData.getAll("issueIndex").map((value) => Number(value)).filter((value) => Number.isInteger(value));
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [reviewArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, reviewArtifactId));
  if (!reviewArtifact || reviewArtifact.projectId !== project.id || reviewArtifact.kind !== "review") {
    throw new Error("Review artifact not found.");
  }

  const review = await readJsonArtifact<CriticReview>(project.rootPath, reviewArtifact.filePath);
  if (!review) {
    throw new Error("Unable to read review artifact.");
  }

  const selectedIssues = issueIndexes.map((index) => review.issues[index]).filter(Boolean) as ReviewIssue[];
  if (selectedIssues.length === 0) {
    throw new Error("请至少勾选一个需要修复的问题。");
  }

  if (!reviewArtifact.parentArtifactId) {
    throw new Error("该审稿记录缺少被审对象，无法修订（请对新生成的草稿/润色稿重新审稿后再修订）。");
  }

  const sourceArtifact = await getArtifactById(project.id, reviewArtifact.parentArtifactId);
  if (!sourceArtifact || (sourceArtifact.kind !== "edit" && sourceArtifact.kind !== "draft")) {
    throw new Error("被审对象不是草稿或润色稿，无法修订。");
  }

  // 修订统一输出 edit artifact；保持谱系：edit 源沿用其 parent（draft），draft 源以自身为 parent。
  const newParentArtifactId = sourceArtifact.kind === "edit" ? sourceArtifact.parentArtifactId ?? sourceArtifact.id : sourceArtifact.id;

  // 读出源变体与正文。
  type SourceVariant = { id: string; title: string; strategy: string; manuscript: string };
  let sourceTitle = sourceArtifact.title;
  let sourceVariants: SourceVariant[];

  if (sourceArtifact.kind === "edit") {
    const editSet = await readJsonArtifact<EditSet>(project.rootPath, sourceArtifact.filePath);
    if (!editSet) {
      throw new Error("Unable to read source edit artifact.");
    }
    sourceTitle = editSet.sourceDraftTitle;
    sourceVariants = editSet.variants.map((variant) => ({ id: variant.id, title: variant.title, strategy: variant.editStrategy, manuscript: variant.manuscript }));
  } else {
    const draftSet = await readJsonArtifact<DraftSet>(project.rootPath, sourceArtifact.filePath);
    if (!draftSet) {
      throw new Error("Unable to read source draft artifact.");
    }
    sourceTitle = draftSet.outlineTitle;
    sourceVariants = draftSet.variants.map((variant) => ({ id: variant.id, title: variant.title, strategy: variant.strategy, manuscript: draftVariantManuscript(variant) }));
  }

  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "editor",
    title: "按审稿修订",
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);
      const variants: EditedVariant[] = [];

      for (const variant of sourceVariants) {
        const variantIssues = issuesForVariant(selectedIssues, variant.id);
        const baseId = variant.id.endsWith("-edited") ? variant.id : `${variant.id}-edited`;

        if (variantIssues.length === 0) {
          // 该变体没有选中问题：原样保留。
          variants.push({
            id: baseId,
            sourceVariantId: variant.id,
            title: variant.title,
            editStrategy: variant.strategy,
            changesMade: [],
            remainingConcerns: [],
            manuscript: variant.manuscript,
          });
          continue;
        }

        const revised: RevisedVariant = await reviseVariantManuscript({
          manuscriptContext,
          projectName: project.name,
          recall,
          variantId: variant.id,
          variantTitle: variant.title,
          manuscript: variant.manuscript,
          issues: variantIssues,
        });

        variants.push({
          id: baseId,
          sourceVariantId: variant.id,
          title: variant.title.includes("（修订版）") ? variant.title : `${variant.title}（修订版）`,
          editStrategy: `按审稿修订：针对 ${variantIssues.length} 个选中问题修复，保留其余内容与变体策略。`,
          changesMade: revised.changesMade,
          remainingConcerns: revised.remainingConcerns,
          manuscript: revised.manuscript,
        });
      }

      const result: EditSet = {
        sourceDraftTitle: sourceTitle,
        variants,
        editorNotes: [`本稿基于审稿记录修订，共处理 ${selectedIssues.length} 个选中问题。建议对修订版再次运行审稿确认问题已消解。`],
      };

      await persistJobArtifact({
        project,
        kind: "edit",
        relativeDir: "finals",
        fileName: "revised-drafts",
        title: `Revised drafts for ${sourceTitle}`,
        content: JSON.stringify(result, null, 2),
        agentId: "editor",
        stepTitle: "Revise per review",
        summary: `Editor revised ${sourceTitle} per ${selectedIssues.length} selected issues.`,
        parentArtifactId: newParentArtifactId,
      });
    },
  });
}

export async function selectFinalVariantForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const editArtifactId = String(formData.get("editArtifactId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [editArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, editArtifactId));
  if (!editArtifact || editArtifact.projectId !== project.id || editArtifact.kind !== "edit") {
    throw new Error("Edited draft artifact not found.");
  }

  const editSet = await readJsonArtifact<EditSet>(project.rootPath, editArtifact.filePath);
  const variant = editSet?.variants.find((item) => item.id === variantId);
  if (!editSet || !variant) {
    throw new Error("Selected edited variant not found.");
  }

  const now = new Date();
  const previousChapters = await latestFinalChapters(project);
  const summary = await summarizeChapterManuscript({
    projectName: project.name,
    title: variant.title,
    manuscript: variant.manuscript,
    label: `第 ${previousChapters.length + 1} 章·生成概要`,
  });
  const chapter: FinalChapter = {
    id: randomUUID(),
    sourceArtifactId: editArtifact.id,
    sourceVariantId: variant.id,
    title: variant.title,
    manuscript: variant.manuscript,
    selectionNote: `Selected from ${editSet.sourceDraftTitle}`,
    createdAt: now.toISOString(),
    summary,
  };
  const chapters = [...previousChapters, chapter];
  const finalManuscript: FinalManuscript = {
    sourceArtifactId: editArtifact.id,
    sourceVariantId: variant.id,
    title: variant.title,
    manuscript: chapters.map((item, index) => `# 第 ${index + 1} 章：${item.title}\n\n${item.manuscript.trim()}`).join("\n\n"),
    selectionNote: `Selected from ${editSet.sourceDraftTitle}`,
    chapters,
  };
  const filePath = await writeArtifact(project.rootPath, "selected-finals", `final-${variant.id}`, JSON.stringify(finalManuscript, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    artifactId,
    currentStep: "final_selection",
    projectId: project.id,
    stepType: "gate",
    summary: `Selected ${variant.title} as the Gate 3 final manuscript.`,
    title: "Select Gate 3 final manuscript",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    parentArtifactId: editArtifact.id,
    kind: "selected_final",
    title: `Selected final: ${variant.title}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
}

/**
 * 从最新终稿中删除指定章节（例如自动续写产出的重复章）。
 * 删除后重算全文与顶层字段，写入新的 selected_final 产物；后续"已写全文"、
 * 续写上文都从最新终稿派生，因此会自动收敛，无需手工改其它地方。
 */
export async function removeFinalChapterForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const chapterId = String(formData.get("chapterId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }
  if (!chapterId) {
    throw new Error("缺少要删除的章节。");
  }

  const chapters = await latestFinalChapters(project);
  const remaining = chapters.filter((chapter) => chapter.id !== chapterId);
  if (remaining.length === chapters.length) {
    throw new Error("未找到要删除的章节（可能已被更新）。");
  }

  const now = new Date();
  const tail = remaining.at(-1);
  const finalManuscript: FinalManuscript = {
    sourceArtifactId: tail?.sourceArtifactId ?? "",
    sourceVariantId: tail?.sourceVariantId ?? "",
    title: tail?.title ?? "（无章节）",
    manuscript: remaining.map((item, index) => `# 第 ${index + 1} 章：${item.title}\n\n${item.manuscript.trim()}`).join("\n\n"),
    selectionNote: `删除 1 章后剩余 ${remaining.length} 章`,
    chapters: remaining,
  };

  const filePath = await writeArtifact(project.rootPath, "selected-finals", `final-trim-${now.getTime()}`, JSON.stringify(finalManuscript, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    artifactId,
    currentStep: "final_selection",
    projectId: project.id,
    stepType: "gate",
    summary: `Removed a chapter; ${remaining.length} chapters remain.`,
    title: "Remove final chapter",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    parentArtifactId: tail?.sourceArtifactId ?? null,
    kind: "selected_final",
    title: `Trimmed final: ${remaining.length} chapters`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
}

async function runFinalDigestChunk(input: {
  chunk: string;
  chunkIndex: number;
  chunkTotal: number;
  finalManuscript: FinalManuscript;
  projectName: string;
}) {
  const prompt = `Project: ${input.projectName}

Selected final manuscript chunk:
${JSON.stringify(
  {
    chunkIndex: input.chunkIndex + 1,
    chunkTotal: input.chunkTotal,
    manuscriptChunk: input.chunk,
    selectionNote: input.finalManuscript.selectionNote,
    sourceVariantId: input.finalManuscript.sourceVariantId,
    title: input.finalManuscript.title,
  },
  null,
  2,
)}

Summarize memory-relevant facts from this selected final manuscript chunk.`;

  return runAgent({
    agent: agents.finalDigest,
    prompt,
    maxTokens: 1400,
    label: `摘要终稿 · 块 ${input.chunkIndex + 1} / 共 ${input.chunkTotal}`,
  });
}

async function runFinalDigest(input: {
  finalManuscript: FinalManuscript;
  projectName: string;
}) {
  const chunks = chunkText(input.finalManuscript.manuscript, 4500);
  const digests: FinalManuscriptDigest[] = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const digest = await runFinalDigestChunk({
      chunk,
      chunkIndex,
      chunkTotal: chunks.length,
      finalManuscript: input.finalManuscript,
      projectName: input.projectName,
    });
    digests.push(digest);
  }

  return {
    chapterState: digests.map((digest, index) => `片段 ${index + 1}: ${digest.chapterState}`).join("\n"),
    canonCandidates: digests.flatMap((digest) => digest.canonCandidates),
    characterChanges: digests.flatMap((digest) => digest.characterChanges),
    keyEvents: digests.flatMap((digest) => digest.keyEvents),
    threadChanges: digests.flatMap((digest) => digest.threadChanges),
    uncertainties: digests.flatMap((digest) => digest.uncertainties),
  } satisfies FinalManuscriptDigest;
}

export async function runArchivistForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const finalArtifactId = String(formData.get("finalArtifactId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [finalArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, finalArtifactId));
  if (!finalArtifact || finalArtifact.projectId !== project.id || finalArtifact.kind !== "selected_final") {
    throw new Error("Selected final artifact not found.");
  }

  const finalManuscript = await readJsonArtifact<FinalManuscript>(project.rootPath, finalArtifact.filePath);
  if (!finalManuscript) {
    throw new Error("Unable to read selected final artifact.");
  }

  await startJob({
    projectId: project.id,
    kind: "archivist",
    title: "生成记忆补丁",
    executor: async () => {
      const recall = await buildNovelRecallContext(project.rootPath);
      const manuscriptContext = await readProjectManuscriptContext(project.id);
      const digest = await runFinalDigest({ finalManuscript, projectName: project.name });

      const prompt = `Project: ${project.name}

前情（续写上文末尾，属于本章之前【已成立】的背景，不要当作本章新增内容；仅用于判断终稿里哪些才是真正的新变化）:
${manuscriptContextExcerpt(manuscriptContext) || "（无前情）"}

Selected final manuscript summary:
${JSON.stringify(digest, null, 2)}

Selected final metadata:
${JSON.stringify(
  {
    sourceArtifactId: finalManuscript.sourceArtifactId,
    sourceVariantId: finalManuscript.sourceVariantId,
    title: finalManuscript.title,
    selectionNote: finalManuscript.selectionNote,
  },
  null,
  2,
)}

Current project memory excerpt:
${recallExcerpt(recall)}

Generate a conservative memory patch proposal. Do not apply changes.
Only propose memory changes for facts that are genuinely new or changed in the selected final manuscript. Do not re-propose facts already established in the 前情 or current memory.`;
      const result = await runAgent({ agent: agents.archivist, prompt, maxTokens: 2400, label: "生成记忆补丁" });

      await persistJobArtifact({
        project,
        kind: "memory_patch",
        relativeDir: "memory-patches",
        fileName: "archivist-memory-patch",
        title: `Memory patch for ${finalManuscript.title}`,
        content: JSON.stringify(result, null, 2),
        agentId: "archivist",
        stepTitle: "Generate Archivist memory patch",
        summary: `Archivist generated a memory patch for ${finalManuscript.title}.`,
      });
    },
  });
}

export async function applyMemoryPatchForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const memoryPatchArtifactId = String(formData.get("memoryPatchArtifactId") ?? "");
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [patchArtifact] = await db.select().from(schema.artifacts).where(eq(schema.artifacts.id, memoryPatchArtifactId));
  if (!patchArtifact || patchArtifact.projectId !== project.id || patchArtifact.kind !== "memory_patch") {
    throw new Error("Memory patch artifact not found.");
  }

  const patch = await readJsonArtifact<MemoryPatch>(project.rootPath, patchArtifact.filePath, memoryPatchSchema);
  if (!patch) {
    throw new Error("Unable to read memory patch artifact.");
  }

  const applied = [];
  for (const change of patch.changes) {
    applied.push(await applyMemoryPatchChange(project.rootPath, change));
  }

  const appliedRecord = {
    sourcePatchArtifactId: patchArtifact.id,
    appliedAt: new Date().toISOString(),
    summary: patch.summary,
    applied,
  };
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "memory-patches/applied", "applied-memory-patch", JSON.stringify(appliedRecord, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    artifactId,
    currentStep: "memory_apply",
    projectId: project.id,
    stepType: "system",
    summary: `Applied memory patch: ${patch.summary.slice(0, 80)}.`,
    title: "Apply approved memory patch",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    kind: "memory_patch",
    title: `Applied memory patch: ${patch.summary.slice(0, 80)}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/memory`);
}

// ===== 自动续写（Autopilot）：一次输入需求，自动跑完多章 =====

const AUTOPILOT_MAX_REVISIONS = 2;
const AUTOPILOT_MAX_CHAPTERS = 10;

type ChapterPipelineResult =
  | { status: "completed"; chapterTitle: string }
  | { status: "quality_failed"; chapterTitle: string; verdict: string; issues: ReviewIssue[] }
  | { status: "duplicate"; chapterTitle: string; similarity: number };

/** 章节相似度阈值：超过则判为与已成章重复，停止自动续写。 */
const AUTOPILOT_DUPLICATE_THRESHOLD = 0.5;
/** 防重复时回看最近多少已成章（不只上一章）。 */
const AUTOPILOT_DEDUP_LOOKBACK = 3;
/** 拆章规划 / 跨章边界里，最多展示多少个已成章的概要。 */
const AUTOPILOT_PRIOR_RECAP_LIMIT = 8;

/**
 * 为一章正文生成情节概要（定稿时调用一次并存进 chapter.summary，之后复用）。
 * 失败时返回空串，不阻断主流程。
 */
async function summarizeChapterManuscript(input: { projectName: string; title: string; manuscript: string; label: string }) {
  try {
    const prompt = `Project: ${input.projectName}

Chapter title: ${input.title}

Chapter manuscript:
${excerptText(input.manuscript, 6000)}

Summarize what happened in this chapter.`;
    const result = await runAgent({ agent: agents.chapterSummary, prompt, maxTokens: 500, label: input.label });
    return result.summary.trim();
  } catch {
    return "";
  }
}

/**
 * 补齐历史章节缺失的 summary（老数据没有），生成后写回一份新的 selected_final。
 * 只在有缺失时才重算，之后各章 summary 复用，不再重复生成。返回补齐后的章节数组。
 */
async function ensureChapterSummaries(
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>,
  chapters: FinalChapter[],
): Promise<FinalChapter[]> {
  const missing = chapters.filter((chapter) => !chapter.summary?.trim());
  if (missing.length === 0) {
    return chapters;
  }

  const filled: FinalChapter[] = [];
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.summary?.trim()) {
      filled.push(chapter);
      continue;
    }
    const summary = await summarizeChapterManuscript({
      projectName: project.name,
      title: chapter.title,
      manuscript: chapter.manuscript,
      label: `补齐第 ${index + 1} 章概要`,
    });
    filled.push({ ...chapter, summary });
  }

  const tail = filled.at(-1);
  const finalManuscript: FinalManuscript = {
    sourceArtifactId: tail?.sourceArtifactId ?? "",
    sourceVariantId: tail?.sourceVariantId ?? "",
    title: tail?.title ?? "（无章节）",
    manuscript: filled.map((item, index) => `# 第 ${index + 1} 章：${item.title}\n\n${item.manuscript.trim()}`).join("\n\n"),
    selectionNote: `补齐 ${missing.length} 章概要`,
    chapters: filled,
  };
  await persistJobArtifact({
    project,
    kind: "selected_final",
    relativeDir: "selected-finals",
    fileName: `final-backfill-summaries`,
    title: `Backfilled chapter summaries (${filled.length} chapters)`,
    content: JSON.stringify(finalManuscript, null, 2),
    stepType: "system",
    stepTitle: "Backfill chapter summaries",
    summary: `Backfilled summaries for ${missing.length} chapters.`,
  });
  return filled;
}

/** 用于跨章上下文的已成章概要行：优先用存好的 summary，缺失则退回 selectionNote。 */
function priorFinalChapterLines(chapters: FinalChapter[]) {
  const recap = chapters.slice(-AUTOPILOT_PRIOR_RECAP_LIMIT);
  const omitted = chapters.length - recap.length;
  const lines = recap.map((chapter, offset) => {
    const globalIndex = omitted + offset + 1;
    const gist = (chapter.summary && chapter.summary.trim()) || chapter.selectionNote || "（无概要）";
    return `- 第 ${globalIndex} 章《${chapter.title}》：${gist}`;
  });
  if (omitted > 0) {
    lines.unshift(`（前 ${omitted} 章从略，仅列最近 ${recap.length} 章）`);
  }
  return lines.join("\n");
}

/** 归一化正文：去空白、标点，只留用于比对的字符流。 */
function normalizeForSimilarity(text: string) {
  return text.replace(/\s+/g, "").replace(/[，。！？、；：""''「」『』（）().,!?;:'"—…·]/g, "");
}

/**
 * 两段正文的近重复度（0~1）。用字符 3-gram 的 Jaccard 相似度：
 * 对中文这类无词边界的文本稳健，且能捕捉"整段几乎照搬"的情况。
 */
function manuscriptSimilarity(a: string, b: string): number {
  const left = normalizeForSimilarity(a);
  const right = normalizeForSimilarity(b);
  if (!left || !right) {
    return 0;
  }
  const shingles = (value: string) => {
    const set = new Set<string>();
    if (value.length < 3) {
      set.add(value);
      return set;
    }
    for (let index = 0; index + 3 <= value.length; index += 1) {
      set.add(value.slice(index, index + 3));
    }
    return set;
  };
  const leftSet = shingles(left);
  const rightSet = shingles(right);
  let intersection = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) {
      intersection += 1;
    }
  }
  const union = leftSet.size + rightSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 把一份选定终稿变体累计追加进 selected_final（chapters[]），关联到当前后台任务 run。 */
async function appendSelectedFinalChapter(input: {
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>;
  editArtifactId: string;
  variant: EditedVariant;
  sourceDraftTitle: string;
}) {
  const previousChapters = await latestFinalChapters(input.project);
  // 定稿时生成本章概要并存下，供后续续写/拆章规划复用（不再重算）。
  const summary = await summarizeChapterManuscript({
    projectName: input.project.name,
    title: input.variant.title,
    manuscript: input.variant.manuscript,
    label: `第 ${previousChapters.length + 1} 章·生成概要`,
  });
  const chapter: FinalChapter = {
    id: randomUUID(),
    sourceArtifactId: input.editArtifactId,
    sourceVariantId: input.variant.id,
    title: input.variant.title,
    manuscript: input.variant.manuscript,
    selectionNote: `Autopilot selected from ${input.sourceDraftTitle}`,
    createdAt: new Date().toISOString(),
    summary,
  };
  const chapters = [...previousChapters, chapter];
  const finalManuscript: FinalManuscript = {
    sourceArtifactId: input.editArtifactId,
    sourceVariantId: input.variant.id,
    title: input.variant.title,
    manuscript: chapters.map((item, index) => `# 第 ${index + 1} 章：${item.title}\n\n${item.manuscript.trim()}`).join("\n\n"),
    selectionNote: `Autopilot selected from ${input.sourceDraftTitle}`,
    chapters,
  };

  await persistJobArtifact({
    project: input.project,
    kind: "selected_final",
    relativeDir: "selected-finals",
    fileName: `final-${input.variant.id}`,
    title: `Selected final: ${input.variant.title}`,
    content: JSON.stringify(finalManuscript, null, 2),
    stepType: "gate",
    stepTitle: "Autopilot select final",
    summary: `Autopilot selected ${input.variant.title}.`,
    parentArtifactId: input.editArtifactId,
  });

  return finalManuscript;
}

/** 自动模式：对一份草稿/润色变体集做审稿；非 pass 则按 issues 修订重审，最多 N 轮。 */
async function autopilotReviewLoop(input: {
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>;
  manuscriptContext: string;
  recall: string;
  editSet: EditSet;
  editArtifactId: string;
  editParentArtifactId: string | null;
}) {
  let editSet = input.editSet;
  let editArtifactId = input.editArtifactId;
  // 修订产出的新 edit 的 parent 始终沿用最初 draft，保持章节谱系不断。
  const editParentArtifactId = input.editParentArtifactId;

  for (let round = 0; round <= AUTOPILOT_MAX_REVISIONS; round += 1) {
    const candidates = reviewCandidates(editSet);
    const reviews: VariantReview[] = [];
    for (const candidate of candidates) {
      const review = await runCriticVariant({
        artifactKind: "edit",
        manuscriptContext: input.manuscriptContext,
        projectName: input.project.name,
        recall: input.recall,
        sourceTitle: editSet.sourceDraftTitle,
        variant: candidate,
      });
      reviews.push(review);
    }

    const issueRank: Record<ReviewIssue["severity"], number> = { blocker: 3, major: 2, minor: 1 };
    const allIssues = reviews.flatMap((review) => review.issues).sort((left, right) => issueRank[right.severity] - issueRank[left.severity]);
    const passingReview = reviews.find((review) => review.verdict === "pass");
    const verdict = strongestVerdict(reviews);
    const strongestVariantId = passingReview?.variantId ?? [...reviews].sort((left, right) => left.issues.length - right.issues.length)[0]?.variantId;
    const criticReview: CriticReview = {
      verdict,
      summary: reviews.map((review) => `${review.variantId}: ${review.summary}`).join("\n"),
      issues: allIssues,
      strongestVariantId,
      finalGateRecommendation: "自动模式审稿。优先处理 blocker/major 问题。",
    };

    await persistJobArtifact({
      project: input.project,
      kind: "review",
      relativeDir: "reviews",
      fileName: "critic-review",
      title: `Critic review for ${editSet.sourceDraftTitle}`,
      content: JSON.stringify(criticReview, null, 2),
      agentId: "critic",
      stepTitle: round === 0 ? "Autopilot review" : `Autopilot re-review (round ${round})`,
      summary: `Autopilot reviewed ${editSet.sourceDraftTitle} (verdict ${verdict}).`,
      parentArtifactId: editArtifactId,
    });

    if (verdict === "pass") {
      const chosen = editSet.variants.find((variant) => variant.id === strongestVariantId) ?? editSet.variants[0];
      return { ok: true as const, editSet, editArtifactId, chosenVariant: chosen };
    }

    if (round === AUTOPILOT_MAX_REVISIONS) {
      return { ok: false as const, verdict, issues: allIssues };
    }

    // 按 issues 修订：逐变体生成修订版，组装新 EditSet。
    const revisedVariants: EditedVariant[] = [];
    for (const variant of editSet.variants) {
      const variantIssues = issuesForVariant(allIssues, variant.id);
      if (variantIssues.length === 0) {
        revisedVariants.push(variant);
        continue;
      }
      const revised: RevisedVariant = await reviseVariantManuscript({
        manuscriptContext: input.manuscriptContext,
        projectName: input.project.name,
        recall: input.recall,
        variantId: variant.id,
        variantTitle: variant.title,
        manuscript: variant.manuscript,
        issues: variantIssues,
      });
      revisedVariants.push({
        id: variant.id,
        sourceVariantId: variant.sourceVariantId,
        title: variant.title.includes("（修订版）") ? variant.title : `${variant.title}（修订版）`,
        editStrategy: `自动修订：针对 ${variantIssues.length} 个问题修复。`,
        changesMade: revised.changesMade,
        remainingConcerns: revised.remainingConcerns,
        manuscript: revised.manuscript,
      });
    }

    editSet = {
      sourceDraftTitle: editSet.sourceDraftTitle,
      variants: revisedVariants,
      editorNotes: [`自动修订第 ${round + 1} 轮。`],
    };
    editArtifactId = await persistJobArtifact({
      project: input.project,
      kind: "edit",
      relativeDir: "finals",
      fileName: "revised-drafts",
      title: `Autopilot revised drafts for ${editSet.sourceDraftTitle}`,
      content: JSON.stringify(editSet, null, 2),
      agentId: "editor",
      stepTitle: `Autopilot revise (round ${round + 1})`,
      summary: `Autopilot revised ${editSet.sourceDraftTitle}.`,
      parentArtifactId: editParentArtifactId ?? undefined,
    });
  }

  // 理论上不可达（循环内已 return）。
  return { ok: false as const, verdict: "revise", issues: [] as ReviewIssue[] };
}

/** 自动模式下完整跑一章：构思→大纲→写作→润色→审稿循环→选终稿→归档并自动应用记忆。 */
async function runChapterPipeline(input: {
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>;
  planned: PlannedChapter;
  /** 本次自动续写这一批要写的章数。 */
  batchTotal: number;
  /** 本章在整部作品里的全局序号（含此前已成章）。 */
  globalIndex: number;
  /** 整体目标：让每章知道自己在整段弧线里要推进什么。 */
  overallGoal: string;
  /** 已落盘的历史成章（前情之后已经写好的章节），用于"已覆盖、勿重演"。 */
  existingChapters: FinalChapter[];
  /** 本批中排在本章之前、已写完的规划章（标题 + 要点）。 */
  priorPlanned: PlannedChapter[];
  /** 下一章规划，用于"给后文留白、不要抢戏"。 */
  nextChapter: PlannedChapter | null;
}): Promise<ChapterPipelineResult> {
  const { project, planned } = input;
  const tag = `第 ${input.globalIndex} 章`;
  const chapterBrief = [planned.title, planned.brief, ...(planned.focus ?? [])].filter(Boolean).join("\n");

  // 每章都重新读取上文（含已成章全文）与记忆（前章已自动写回）。
  const manuscriptContext = await requireProjectManuscriptContext(project);
  const recall = await buildNovelRecallContext(project.rootPath);

  // 跨章边界说明：显式告诉本章"整体目标 / 前面已写什么 / 下一章留给谁"，
  // 避免每章只看到"全文末尾 + 本章要点"而就地重演已成章的场面。
  const existingRecap = input.existingChapters.length
    ? priorFinalChapterLines(input.existingChapters)
    : "（前情之后还没有已成章）";
  const batchPriorSummary = input.priorPlanned.length
    ? input.priorPlanned.map((chapter, offset) => `- 第 ${input.globalIndex - input.priorPlanned.length + offset} 章《${chapter.title}》：${chapter.brief}`).join("\n")
    : "（本章是这批自动续写的第一章）";
  const nextSummary = input.nextChapter
    ? `- 第 ${input.globalIndex + 1} 章《${input.nextChapter.title}》：${input.nextChapter.brief}`
    : "（本章是这批自动续写的最后一章）";
  const chapterBoundary = `整体目标（本章必须朝它推进，而不是原地打转）:
${input.overallGoal}

本章是全书第 ${input.globalIndex} 章。

【前情之后已成章】（这些已经写完并发生，本章绝不可重述、重演或倒退，必须从最后一章的结尾继续向前）:
${existingRecap}

本批此前已写章节（同样不得重演）:
${batchPriorSummary}

下一章计划（把这些留给下一章，本章不要抢先写完）:
${nextSummary}

本章要交付的【新】进展（相较上一章的新变化：地点/信息/关系/状态至少推进一项）:
${chapterBrief}`;

  // 1. 构思方向（自动采纳推荐）。
  const directionPrompt = `Project: ${project.name}

续写上文（所有方向必须从这段上文的末尾自然延展，不得跳过当前场面）:
${manuscriptContextExcerpt(manuscriptContext)}

${chapterBoundary}

Project memory:
${recallExcerpt(recall)}

请给出承接上文、且明显不同于"此前已写章节"的续写方向。Return three options unless the brief asks otherwise.`;
  const directionSet = await runAgent({ agent: agents.muse, prompt: directionPrompt, maxTokens: 2200, label: `${tag}·构思方向` });
  const directionArtifactId = await persistJobArtifact({
    project,
    kind: "direction",
    relativeDir: "directions",
    fileName: "muse-directions",
    title: `Muse direction options (${tag})`,
    content: JSON.stringify({ ...directionSet, brief: chapterBrief }, null, 2),
    agentId: "muse",
    stepTitle: `${tag} directions`,
    summary: `Autopilot generated directions for ${tag}.`,
  });
  // 自动选路：优先采纳 recommendation 指向的 option，否则取第一个。
  const recommended = directionSet.options.find((option) => directionSet.recommendation.includes(option.id) || directionSet.recommendation.includes(option.title));
  const selectedOption: DirectionOption = recommended ?? directionSet.options[0];

  // 2. 章节大纲。
  const outlinePrompt = `Project: ${project.name}

续写上文（章节大纲第一场必须承接这段上文的最后状态、地点、人物动作和情绪）:
${manuscriptContextExcerpt(manuscriptContext)}

${chapterBoundary}

Selected direction:
${JSON.stringify(selectedOption, null, 2)}

Full Muse recommendation:
${directionSet.recommendation}

Project memory:
${recallExcerpt(recall)}

Create a chapter beat sheet for this selected direction. 大纲的每一场都要服务于"本章新进展"，不得重复"此前已写章节"里的场面或情绪转折。`;
  const beatSheet = await runAgent({ agent: agents.architect, prompt: outlinePrompt, maxTokens: 2600, label: `${tag}·生成大纲` });
  const outlineArtifactId = await persistJobArtifact({
    project,
    kind: "outline",
    relativeDir: "outlines",
    fileName: `outline-${selectedOption.id}`,
    title: `Architect outline (${tag})`,
    content: JSON.stringify(beatSheet, null, 2),
    agentId: "architect",
    stepTitle: `${tag} outline`,
    summary: `Autopilot generated outline for ${tag}.`,
    parentArtifactId: directionArtifactId,
  });

  // 3. 分段写作（A/B 两个变体）。
  const variantRequests = [
    { id: "A" as const, strategy: "紧凑推进：强调悬念、行动压力和场景钩子。" },
    { id: "B" as const, strategy: "情绪压迫：强调人物感受、关系张力和细节余波。" },
  ];
  const draftVariants: DraftVariant[] = [];
  for (const request of variantRequests) {
    draftVariants.push(
      await runScribeVariant({
        beatSheet,
        manuscriptContext,
        projectName: project.name,
        recall,
        variantId: request.id,
        variantStrategy: request.strategy,
      }),
    );
  }
  const draftSet: DraftSet = {
    outlineTitle: beatSheet.chapterTitle,
    variants: draftVariants,
    notesForEditor: ["自动模式按变体生成草稿。"],
  };
  const draftArtifactId = await persistJobArtifact({
    project,
    kind: "draft",
    relativeDir: "drafts",
    fileName: "scribe-drafts",
    title: `Scribe drafts (${tag})`,
    content: JSON.stringify(draftSet, null, 2),
    agentId: "scribe",
    stepTitle: `${tag} drafts`,
    summary: `Autopilot generated drafts for ${tag}.`,
    parentArtifactId: outlineArtifactId,
  });

  // 4. 逐场润色，组装 EditSet。
  const editedVariants: EditedVariant[] = [];
  for (const variant of draftSet.variants) {
    const editedSegments: EditedSegment[] = [];
    const sceneTotal = variant.segments.length;
    for (const [segmentIndex, segment] of variant.segments.entries()) {
      const previousContext = editedSegments.map((item) => item.manuscript).join("\n\n");
      const nextSegment = variant.segments[segmentIndex + 1];
      const editedSegment = await runEditorSegment({
        draftSetTitle: draftSet.outlineTitle,
        manuscriptContext,
        nextSceneHint: nextSegment ? `${nextSegment.sceneId}: ${nextSegment.sceneTitle} — ${nextSegment.manuscript.slice(0, 500)}` : undefined,
        previousContext,
        projectName: project.name,
        recall,
        segment,
        variant,
        label: `${tag}·润色 变体 ${variant.id} · 第 ${segmentIndex + 1} 场 / 共 ${sceneTotal} 场`,
      });
      editedSegments.push(editedSegment);
    }
    editedVariants.push({
      id: `${variant.id}-edited`,
      sourceVariantId: variant.id,
      title: `${variant.title}（润色版）`,
      editStrategy: `按场景分段润色，保持“${variant.strategy}”的变体策略。`,
      changesMade: editedSegments.flatMap((segment) => segment.changesMade.map((change) => `${segment.sceneId}: ${change}`)),
      remainingConcerns: editedSegments.flatMap((segment) => segment.remainingConcerns.map((concern) => `${segment.sceneId}: ${concern}`)),
      manuscript: editedSegments.map((segment) => segment.manuscript.trim()).filter(Boolean).join("\n\n"),
    });
  }
  const editSet: EditSet = {
    sourceDraftTitle: draftSet.outlineTitle,
    variants: editedVariants,
    editorNotes: ["自动模式按场景分段润色。"],
  };
  const editArtifactId = await persistJobArtifact({
    project,
    kind: "edit",
    relativeDir: "finals",
    fileName: "editor-polished-drafts",
    title: `Editor polished drafts (${tag})`,
    content: JSON.stringify(editSet, null, 2),
    agentId: "editor",
    stepTitle: `${tag} polish`,
    summary: `Autopilot polished ${tag}.`,
    parentArtifactId: draftArtifactId,
  });

  // 5. 审稿循环（非 pass 自动修订重审，最多 N 轮）。
  const reviewed = await autopilotReviewLoop({
    project,
    manuscriptContext,
    recall,
    editSet,
    editArtifactId,
    editParentArtifactId: draftArtifactId,
  });
  if (!reviewed.ok) {
    return { status: "quality_failed", chapterTitle: beatSheet.chapterTitle, verdict: reviewed.verdict, issues: reviewed.issues };
  }

  // 5.5 近重复兜底：与最近若干已成章正文比对，过高则判为重复并停下，不把重复章交付进全文。
  //     prompt 侧已强约束不重演，这里是硬网——模型仍产出雷同章时不静默通过。
  const previousChapters = await latestFinalChapters(project);
  const recentChapters = previousChapters.slice(-AUTOPILOT_DEDUP_LOOKBACK);
  let maxSimilarity = 0;
  for (const prior of recentChapters) {
    maxSimilarity = Math.max(maxSimilarity, manuscriptSimilarity(prior.manuscript, reviewed.chosenVariant.manuscript));
  }
  if (maxSimilarity >= AUTOPILOT_DUPLICATE_THRESHOLD) {
    return { status: "duplicate", chapterTitle: beatSheet.chapterTitle, similarity: maxSimilarity };
  }

  // 6. 选定终稿，累计进全文。
  const finalManuscript = await appendSelectedFinalChapter({
    project,
    editArtifactId: reviewed.editArtifactId,
    variant: reviewed.chosenVariant,
    sourceDraftTitle: reviewed.editSet.sourceDraftTitle,
  });

  // 7. 归档：生成记忆补丁并【自动应用】（多章连跑，让后章看到前章新设定）。
  const digest = await runFinalDigest({ finalManuscript, projectName: project.name });
  const memoryPrompt = `Project: ${project.name}

前情（续写上文末尾，属于本章之前【已成立】的背景，不要当作本章新增内容）:
${manuscriptContextExcerpt(manuscriptContext) || "（无前情）"}

Selected final manuscript summary:
${JSON.stringify(digest, null, 2)}

Current project memory excerpt:
${recallExcerpt(recall)}

Generate a conservative memory patch proposal. Only propose genuinely new or changed facts.`;
  const patch = await runAgent({ agent: agents.archivist, prompt: memoryPrompt, maxTokens: 2400, label: `${tag}·生成记忆补丁` });
  await persistJobArtifact({
    project,
    kind: "memory_patch",
    relativeDir: "memory-patches",
    fileName: "archivist-memory-patch",
    title: `Memory patch (${tag})`,
    content: JSON.stringify(patch, null, 2),
    agentId: "archivist",
    stepTitle: `${tag} memory patch`,
    summary: `Autopilot generated memory patch for ${tag}.`,
  });
  // 自动应用（仅多章连跑期间）。
  for (const change of patch.changes) {
    await applyMemoryPatchChange(project.rootPath, change);
  }

  return { status: "completed", chapterTitle: beatSheet.chapterTitle };
}

export async function runAutopilotForProject(formData: FormData) {
  "use server";

  const projectId = String(formData.get("projectId") ?? "");
  const overallGoal = String(formData.get("overallGoal") ?? "").trim();
  const chapterCountRaw = Number(formData.get("chapterCount") ?? 0);
  const perChapterBriefs = String(formData.get("perChapterBriefs") ?? "")
    .split("\n")
    .map((line) => line.trim());
  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found.");
  }
  if (!overallGoal) {
    throw new Error("请填写整体目标。");
  }
  const chapterCount = Math.min(Math.max(Math.floor(chapterCountRaw) || 1, 1), AUTOPILOT_MAX_CHAPTERS);

  await requireProjectManuscriptContext(project);

  await startJob({
    projectId: project.id,
    kind: "autopilot",
    title: `自动续写 ${chapterCount} 章`,
    executor: async () => {
      const manuscriptContext = await requireProjectManuscriptContext(project);
      const recall = await buildNovelRecallContext(project.rootPath);

      // 0. 补齐历史成章的概要（老数据无 summary），后续复用。得到全局已成章基线。
      const existingChapters = await ensureChapterSummaries(project, await latestFinalChapters(project));
      const priorCount = existingChapters.length;

      // 1. 拆章规划（显式产物）。规划器需要知道"前情之后已经写了哪些章"，
      //    以便从第 (priorCount + 1) 章接着往后规划、不与已成章重叠。
      const existingRecap = priorCount ? priorFinalChapterLines(existingChapters) : "（前情之后还没有已成章）";
      const perChapterLines = perChapterBriefs
        .map((brief, index) => (brief ? `第 ${index + 1} 章要点：${brief}` : `第 ${index + 1} 章：未指定（按整体目标自行编排）`))
        .slice(0, chapterCount)
        .join("\n");
      const planPrompt = `Project: ${project.name}

续写上文末尾:
${manuscriptContextExcerpt(manuscriptContext)}

【前情之后已成章】（全书已写到第 ${priorCount} 章，以下是已发生内容，新规划必须从第 ${priorCount + 1} 章接着往后，绝不可与这些重叠或重演）:
${existingRecap}

整体目标:
${overallGoal}

需要新规划的章节数：${chapterCount}（这些是接在第 ${priorCount} 章之后的【新】章）

逐章要点（对应本批新章，有则必须遵循，无则按整体目标自行编排）:
${perChapterLines}

Project memory:
${recallExcerpt(recall)}

Break this into exactly ${chapterCount} NEW chapter plans that continue AFTER chapter ${priorCount}.`;
      const plan: ChapterPlan = await runAgent({ agent: agents.chapterPlanner, prompt: planPrompt, maxTokens: 2600, label: "拆解章节规划" });
      // 把规划的 index 重映射为全局序号，展示与后续都用全局编号。
      const planned = plan.chapters.slice(0, chapterCount).map((chapter, offset) => ({ ...chapter, index: priorCount + offset + 1 }));
      await persistJobArtifact({
        project,
        kind: "chapter_plan",
        relativeDir: "chapter-plans",
        fileName: "autopilot-chapter-plan",
        title: `Autopilot chapter plan (chapters ${priorCount + 1}-${priorCount + planned.length})`,
        content: JSON.stringify({ ...plan, chapters: planned, priorChapterCount: priorCount }, null, 2),
        stepType: "system",
        stepTitle: "Chapter plan",
        summary: `Autopilot planned chapters ${priorCount + 1}-${priorCount + planned.length}.`,
      });

      // 2. 逐章跑流水线（全局编号 = priorCount + 本批序号）。
      for (const [chapterIndex, chapter] of planned.entries()) {
        if (currentProgress()?.isCancelled) {
          return;
        }
        const result = await runChapterPipeline({
          project,
          planned: chapter,
          batchTotal: planned.length,
          globalIndex: priorCount + chapterIndex + 1,
          overallGoal: plan.overallGoal || overallGoal,
          existingChapters,
          priorPlanned: planned.slice(0, chapterIndex),
          nextChapter: planned[chapterIndex + 1] ?? null,
        });
        if (result.status === "quality_failed") {
          const blockers = result.issues.filter((issue) => issue.severity !== "minor").slice(0, 8).map((issue) => `- [${issue.severity}] ${issue.problem}`).join("\n");
          throw new Error(`在「${result.chapterTitle}」质量未达标（审稿 ${result.verdict}），已停止并保留此前已成章。未消解的主要问题：\n${blockers}`);
        }
        if (result.status === "duplicate") {
          throw new Error(`在「${result.chapterTitle}」检测到与已成章高度重复（相似度 ${(result.similarity * 100).toFixed(0)}%），已停止并保留此前已成章。请调整该章要点或整体目标，让本章推进到新的情节，再重新自动续写。`);
        }
      }
    },
  });
}
