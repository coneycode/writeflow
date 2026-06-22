import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

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

export async function listProjects() {
  return db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt));
}

export async function getProject(projectId: string) {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  return project ?? null;
}

export async function listProjectArtifacts(projectId: string, kind?: "direction" | "outline" | "draft") {
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
