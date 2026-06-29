import fs from "node:fs/promises";
import path from "node:path";

export async function writeArtifact(rootPath: string, kind: string, title: string, content: string) {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "artifact";
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeTitle}.json`;
  const relativePath = path.join("artifacts", kind, fileName);
  const target = path.join(rootPath, relativePath);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");

  return relativePath;
}

export async function overwriteArtifact(rootPath: string, relativePath: string, content: string) {
  const target = path.resolve(rootPath, relativePath);
  const artifactRoot = path.resolve(rootPath, "artifacts");

  if (!target.startsWith(artifactRoot + path.sep)) {
    throw new Error(`Artifact path escapes project artifacts: ${relativePath}`);
  }

  await fs.writeFile(target, content, "utf8");
}

export async function readJsonArtifact<T>(rootPath: string, relativePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(path.join(rootPath, relativePath), "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
