import fs from "node:fs/promises";
import path from "node:path";

/** 前瞻记忆（创作纲领）：始终排在 recall 最前，且截断时全量保留（见 recallExcerpt）。 */
export const BLUEPRINT_RECALL_FILE = "memory/plan/blueprint.md";

const recallFiles = [
  BLUEPRINT_RECALL_FILE,
  "memory/progress/state.md",
  "memory/progress/open_threads.md",
  "memory/canon/world.md",
  "memory/canon/timeline.md",
  "memory/style/voice.md",
  "memory/style/taboo.md",
];

async function readIfExists(rootPath: string, relativePath: string) {
  try {
    return await fs.readFile(path.join(rootPath, relativePath), "utf8");
  } catch {
    return "";
  }
}

export async function buildNovelRecallContext(rootPath: string) {
  const entries = await Promise.all(
    recallFiles.map(async (relativePath) => ({
      relativePath,
      content: await readIfExists(rootPath, relativePath),
    })),
  );

  const characterDir = path.join(rootPath, "memory/canon/characters");
  let characterEntries: Array<{ relativePath: string; content: string }> = [];
  try {
    const files = await fs.readdir(characterDir);
    characterEntries = await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async (file) => ({
          relativePath: `memory/canon/characters/${file}`,
          content: await readIfExists(rootPath, `memory/canon/characters/${file}`),
        })),
    );
  } catch {
    characterEntries = [];
  }

  return [...entries, ...characterEntries]
    .map(({ relativePath, content }) => `## ${relativePath}\n${content.trim() || "(empty)"}`)
    .join("\n\n");
}
