import fs from "node:fs/promises";
import path from "node:path";

export const dataRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.WRITEFLOW_DATA_DIR ?? "data");
export const projectsRoot = () => path.join(dataRoot(), "projects");

export function projectRoot(projectId: string) {
  return path.join(projectsRoot(), projectId);
}

export async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function slugifyProjectName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "untitled";
}
