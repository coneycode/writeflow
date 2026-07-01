import fs from "node:fs/promises";
import path from "node:path";

import type { ZodType } from "zod";

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

/**
 * 读取并解析 JSON 产物。传入 schema 时做运行时校验：磁盘上存在不符合 schema 的
 * 旧/残缺产物（如缺字段）会返回 null，交由调用方走"无法读取"分支，
 * 而不是把半个对象渗进 UI 引发 undefined.map 之类的运行时崩溃。
 */
export async function readJsonArtifact<T>(rootPath: string, relativePath: string, schema?: ZodType<T>): Promise<T | null> {
  try {
    const content = await fs.readFile(path.join(rootPath, relativePath), "utf8");
    const parsed = JSON.parse(content);
    if (schema) {
      const result = schema.safeParse(parsed);
      return result.success ? result.data : null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}
