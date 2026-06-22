import fs from "node:fs/promises";
import path from "node:path";

export type MemoryTemplateFile = {
  path: string;
  content: string;
};

export const novelMemoryTemplates: MemoryTemplateFile[] = [
  {
    path: "memory/canon/characters/_template.md",
    content: `# Character Name

- One-line role:
- External facts:
- Motivation:
- Fear:
- Voice:
- Relationships:
- Arc:
- Hard rules:
`,
  },
  {
    path: "memory/canon/world.md",
    content: `# World Canon

## Rules
-

## Places
-

## Constraints
-
`,
  },
  {
    path: "memory/canon/timeline.md",
    content: `# Timeline

## Established Events
-
`,
  },
  {
    path: "memory/progress/state.md",
    content: `# Current State

- Written through:
- Story time:
- Current situation:
- Next chapter intent:
`,
  },
  {
    path: "memory/progress/open_threads.md",
    content: `# Open Threads

| ID | Introduced | Content | Status | Planned Payoff |
| --- | --- | --- | --- | --- |
| T1 | | | open | |
`,
  },
  {
    path: "memory/style/voice.md",
    content: `# Voice Profile

- POV / tense:
- Rhythm:
- Diction:
- Sample passage:
`,
  },
  {
    path: "memory/style/taboo.md",
    content: `# Taboos

## Avoided Words
-

## Avoided Moves
-

## AI-ish Habits To Reject
- Empty lyricism without concrete action
- Repeated stock phrases
- Unmotivated emotional conclusions
`,
  },
  {
    path: "artifacts/.gitkeep",
    content: "",
  },
  {
    path: "runs/.gitkeep",
    content: "",
  },
];

export async function writeNovelProjectTemplate(rootPath: string) {
  await Promise.all(
    novelMemoryTemplates.map(async (file) => {
      const target = path.join(rootPath, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, "utf8");
    }),
  );
}
