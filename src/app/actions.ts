import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { db, schema } from "@/db/client";
import { agents } from "@/agents/registry";
import { runAgent } from "@/core/agent-runner";
import { readJsonArtifact, writeArtifact } from "@/core/artifact-store";
import { ensureDirectory, projectRoot, slugifyProjectName } from "@/lib/paths";
import { writeNovelProjectTemplate } from "@/memory/templates";
import { buildNovelRecallContext } from "@/memory/recall";
import { createProjectSchema } from "@/schemas/project";
import type { BeatSheet } from "@/schemas/beat-sheet";
import type { DirectionSet } from "@/schemas/direction";
import type { DraftSet } from "@/schemas/draft";
import type { EditSet } from "@/schemas/edit";
import type { CriticReview } from "@/schemas/review";
import type { FinalManuscript } from "@/schemas/final-manuscript";
import type { MemoryPatch } from "@/schemas/memory-patch";


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

export async function listProjects() {
  return db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt));
}

export async function getProject(projectId: string) {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  return project ?? null;
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

  const recall = await buildNovelRecallContext(project.rootPath);
  const prompt = `Project: ${project.name}\n\nUser brief:\n${brief || "Generate three strong continuation directions from the current project memory."}\n\nProject memory:\n${recall}\n\nReturn three options unless the brief asks otherwise.`;
  const result = await runAgent({ agent: agents.muse, prompt, maxTokens: 2200 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "directions", "muse-directions", JSON.stringify(result, null, 2));

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
    kind: "direction",
    title: "Muse direction options",
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));

  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
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

  const recall = await buildNovelRecallContext(project.rootPath);
  const prompt = `Project: ${project.name}\n\nApproved beat sheet:\n${JSON.stringify(beatSheet, null, 2)}\n\nProject memory:\n${recall}\n\nWrite two prose variants for this chapter. Keep each variant substantial but focused enough for review.`;
  const result = await runAgent({ agent: agents.scribe, prompt, maxTokens: 5200 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "drafts", "scribe-drafts", JSON.stringify(result, null, 2));

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
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

  const recall = await buildNovelRecallContext(project.rootPath);
  const prompt = `Project: ${project.name}\n\nSelected direction:\n${JSON.stringify(selectedOption, null, 2)}\n\nFull Muse recommendation:\n${directionSet?.recommendation ?? ""}\n\nProject memory:\n${recall}\n\nCreate a chapter beat sheet for this selected direction.`;
  const result = await runAgent({ agent: agents.architect, prompt, maxTokens: 2600 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "outlines", `outline-${selectedOption.id}`, JSON.stringify(result, null, 2));

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
    kind: "outline",
    title: `Architect outline for option ${selectedOption.id}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));

  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/runs`);
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

  const recall = await buildNovelRecallContext(project.rootPath);
  const prompt = `Project: ${project.name}

Draft variants:
${JSON.stringify(draftSet, null, 2)}

Project memory:
${recall}

Polish these variants for Gate 3 review. Preserve story logic and variant differences.`;
  const result = await runAgent({ agent: agents.editor, prompt, maxTokens: 6200 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "finals", "editor-polished-drafts", JSON.stringify(result, null, 2));

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
    kind: "edit",
    title: `Editor polished drafts for ${draftSet.outlineTitle}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
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

  const recall = await buildNovelRecallContext(project.rootPath);
  const prompt = `Project: ${project.name}

Review source artifact kind: ${artifactKind}

Drafts to review:
${JSON.stringify(source, null, 2)}

Project memory:
${recall}

Critically review these variants for Gate 3 selection.`;
  const result = await runAgent({ agent: agents.critic, prompt, maxTokens: 3600 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "reviews", "critic-review", JSON.stringify(result, null, 2));

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
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

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
    kind: "selected_final",
    title: `Selected final: ${variant.title}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
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
  const prompt = `Project: ${project.name}

Selected final manuscript:
${JSON.stringify(finalManuscript, null, 2)}

Current project memory:
${recall}

Generate a conservative memory patch proposal. Do not apply changes.`;
  const result = await runAgent({ agent: agents.archivist, prompt, maxTokens: 3200 });
  const now = new Date();
  const filePath = await writeArtifact(project.rootPath, "memory-patches", "archivist-memory-patch", JSON.stringify(result, null, 2));

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
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

  await db.insert(schema.artifacts).values({
    id: randomUUID(),
    projectId: project.id,
    kind: "memory_patch",
    title: `Applied memory patch: ${patch.summary.slice(0, 80)}`,
    filePath,
    createdAt: now,
  });

  await db.update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/memory`);
}
