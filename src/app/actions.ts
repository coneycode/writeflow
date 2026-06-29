import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { db, schema } from "@/db/client";
import { agents } from "@/agents/registry";
import { runAgent } from "@/core/agent-runner";
import { overwriteArtifact, readJsonArtifact, writeArtifact } from "@/core/artifact-store";
import { ensureDirectory, projectRoot, slugifyProjectName } from "@/lib/paths";
import { writeNovelProjectTemplate } from "@/memory/templates";
import { buildNovelRecallContext } from "@/memory/recall";
import { createProjectSchema } from "@/schemas/project";
import type { BeatSheet } from "@/schemas/beat-sheet";
import type { DirectionSet } from "@/schemas/direction";
import { draftSetSchema, type DraftSegment, type DraftSet, type DraftVariant } from "@/schemas/draft";
import type { EditedSegment, EditedVariant, EditSet } from "@/schemas/edit";
import type { CriticReview, ReviewIssue, VariantReview } from "@/schemas/review";
import type { FinalManuscript } from "@/schemas/final-manuscript";
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

async function requireProjectManuscriptContext(project: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  const content = (await readProjectManuscriptContext(project.id)).trim();
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

export async function listProjectArtifacts(projectId: string, kind?: "direction" | "outline" | "draft" | "edit" | "review" | "selected_final" | "memory_patch") {
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
      data: await readJsonArtifact<MemoryPatch>(project.rootPath, artifact.filePath),
    })),
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
  const result = await runAgent({ agent: agents.muse, prompt, maxTokens: 2200 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "directions", "muse-directions", JSON.stringify(result, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    agentId: "muse",
    artifactId,
    currentStep: "directions",
    projectId: project.id,
    stepType: "agent",
    summary: "Muse generated story direction options.",
    title: "Generate Muse directions",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    kind: "direction",
    title: "Muse direction options",
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));

  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
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

  return runAgent({ agent: agents.scribeSegment, prompt, maxTokens: 2600 });
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

  const manuscriptContext = await requireProjectManuscriptContext(project);
  const recall = await buildNovelRecallContext(project.rootPath);
  const variantRequests = [
    { id: "A" as const, strategy: "紧凑推进：强调悬念、行动压力和场景钩子。" },
    { id: "B" as const, strategy: "情绪压迫：强调人物感受、关系张力和细节余波。" },
  ];
  const variants: DraftVariant[] = [];

  for (const variantRequest of variantRequests) {
    try {
      const variant = await runScribeVariant({
        beatSheet,
        manuscriptContext,
        projectName: project.name,
        recall,
        variantId: variantRequest.id,
        variantStrategy: variantRequest.strategy,
      });
      variants.push(variant);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Scribe variant agent failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        message,
        maxTokens: 3600,
        variantId: variantRequest.id,
      });
      await recordWorkflowRun({
        agentId: "scribe",
        currentStep: "drafting",
        projectId: project.id,
        status: "failed",
        stepType: "agent",
        summary: `Scribe failed for ${beatSheet.chapterTitle} variant ${variantRequest.id}: ${message.slice(0, 160)}`,
        title: "Generate Scribe draft variant",
      });
      throw error;
    }
  }

  const result: DraftSet = {
    outlineTitle: beatSheet.chapterTitle,
    variants,
    notesForEditor: ["草稿已按变体拆分生成，以降低长正文请求超时风险。请重点检查两版之间的节奏差异和场景连续性。"],
  };

  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "drafts", "scribe-drafts", JSON.stringify(result, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    agentId: "scribe",
    artifactId,
    currentStep: "drafting",
    projectId: project.id,
    stepType: "agent",
    summary: `Scribe generated draft variants for ${beatSheet.chapterTitle}.`,
    title: "Generate Scribe draft variants",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    kind: "draft",
    title: `Scribe drafts for ${beatSheet.chapterTitle}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));

  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
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
  const result = await runAgent({ agent: agents.architect, prompt, maxTokens: 2600 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "outlines", `outline-${selectedOption.id}`, JSON.stringify(result, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    agentId: "architect",
    artifactId,
    currentStep: "outline",
    projectId: project.id,
    stepType: "agent",
    summary: `Architect generated an outline for option ${selectedOption.id}.`,
    title: "Generate Architect outline",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    kind: "outline",
    title: `Architect outline for option ${selectedOption.id}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));

  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
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

  return runAgent({ agent: agents.editorSegment, prompt, maxTokens: 2200 });
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

  const manuscriptContext = await requireProjectManuscriptContext(project);
  const recall = await buildNovelRecallContext(project.rootPath);
  const variants: EditedVariant[] = [];

  for (const variant of draftSet.variants) {
    const editedSegments: EditedSegment[] = [];

    for (const [segmentIndex, segment] of variant.segments.entries()) {
      try {
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
        });
        editedSegments.push(editedSegment);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Editor segment agent failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          message,
          maxTokens: 2200,
          sceneId: segment.sceneId,
          variantId: variant.id,
        });
        await recordWorkflowRun({
          agentId: "editor",
          currentStep: "editing",
          projectId: project.id,
          status: "failed",
          stepType: "agent",
          summary: `Editor failed for ${draftSet.outlineTitle} variant ${variant.id} scene ${segment.sceneId}: ${message.slice(0, 160)}`,
          title: "Polish draft scene",
        });
        throw error;
      }
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
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "finals", "editor-polished-drafts", JSON.stringify(result, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    agentId: "editor",
    artifactId,
    currentStep: "editing",
    projectId: project.id,
    stepType: "agent",
    summary: `Editor polished drafts for ${draftSet.outlineTitle}.`,
    title: "Polish draft variants",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    kind: "edit",
    title: `Editor polished drafts for ${draftSet.outlineTitle}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
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

  return runAgent({ agent: agents.criticVariant, prompt, maxTokens: 1800 });
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

  const manuscriptContext = await requireProjectManuscriptContext(project);
  const recall = await buildNovelRecallContext(project.rootPath);
  const reviews: VariantReview[] = [];
  const candidates = reviewCandidates(source);

  for (const candidate of candidates) {
    try {
      const review = await runCriticVariant({
        artifactKind,
        manuscriptContext,
        projectName: project.name,
        recall,
        sourceTitle: sourceArtifact.title,
        variant: candidate,
      });
      reviews.push(review);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Critic variant agent failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        message,
        maxTokens: 2200,
        variantId: candidate.id,
      });
      await recordWorkflowRun({
        agentId: "critic",
        currentStep: "reviewing",
        projectId: project.id,
        status: "failed",
        stepType: "agent",
        summary: `Critic failed for ${sourceArtifact.title} variant ${candidate.id}: ${message.slice(0, 160)}`,
        title: "Run Critic variant review",
      });
      throw error;
    }
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
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "reviews", "critic-review", JSON.stringify(result, null, 2));
  const reviewArtifactId = randomUUID();
  const runId = await recordWorkflowRun({
    agentId: "critic",
    artifactId: reviewArtifactId,
    currentStep: "reviewing",
    projectId: project.id,
    stepType: "agent",
    summary: `Critic reviewed ${sourceArtifact.title}.`,
    title: "Run Critic review",
  });

  await db.insert(schema.artifacts).values({
    id: reviewArtifactId,
    projectId: project.id,
    runId,
    kind: "review",
    title: `Critic review for ${sourceArtifact.title}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
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

  const finalManuscript: FinalManuscript = {
    sourceArtifactId: editArtifact.id,
    sourceVariantId: variant.id,
    title: variant.title,
    manuscript: variant.manuscript,
    selectionNote: `Selected from ${editSet.sourceDraftTitle}`,
  };
  const now = new Date();
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
    kind: "selected_final",
    title: `Selected final: ${variant.title}`,
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

  return runAgent({ agent: agents.finalDigest, prompt, maxTokens: 1400 });
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

  const recall = await buildNovelRecallContext(project.rootPath);
  let digest: FinalManuscriptDigest;

  try {
    digest = await runFinalDigest({ finalManuscript, projectName: project.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Archivist final digest agent failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      finalArtifactId,
      message,
      maxTokens: 1800,
    });
    await recordWorkflowRun({
      agentId: "archivist",
      currentStep: "memory_patch",
      projectId: project.id,
      status: "failed",
      stepType: "agent",
      summary: `Archivist digest failed for ${finalManuscript.title}: ${message.slice(0, 160)}`,
      title: "Summarize final manuscript",
    });
    throw error;
  }

  const prompt = `Project: ${project.name}

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

Generate a conservative memory patch proposal. Do not apply changes.`;
  const result = await runAgent({ agent: agents.archivist, prompt, maxTokens: 2400 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "memory-patches", "archivist-memory-patch", JSON.stringify(result, null, 2));
  const artifactId = randomUUID();
  const runId = await recordWorkflowRun({
    agentId: "archivist",
    artifactId,
    currentStep: "memory_patch",
    projectId: project.id,
    stepType: "agent",
    summary: `Archivist generated a memory patch for ${finalManuscript.title}.`,
    title: "Generate Archivist memory patch",
  });

  await db.insert(schema.artifacts).values({
    id: artifactId,
    projectId: project.id,
    runId,
    kind: "memory_patch",
    title: `Memory patch for ${finalManuscript.title}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
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

  const patch = await readJsonArtifact<MemoryPatch>(project.rootPath, patchArtifact.filePath);
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
