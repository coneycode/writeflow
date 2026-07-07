import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import { notFound } from "next/navigation";

import { generateBlueprintForProject, getProject, updateProjectMemoryFile } from "@/app/actions";
import { MemoryFileCard } from "@/components/workspace/memory-file-card";
import { BlueprintGenerateForm } from "@/components/workspace/blueprint-generate-form";

const memoryFiles = [
  ["创作纲领", "memory/plan/blueprint.md", "写正文之前定的意图与方向：整体目标、伏笔规划、人物弧线、关键设定、结局基调。"],
  ["当前状态", "memory/progress/state.md", "记录故事当前进展，以及下一章需要推进什么。"],
  ["开放线索", "memory/progress/open_threads.md", "未解决线索、叙事承诺和计划回收点。"],
  ["世界设定", "memory/canon/world.md", "稳定的世界规则、地点、限制和 canon 事实。"],
  ["时间线", "memory/canon/timeline.md", "按故事顺序记录已发生事件，用于避免连续性错误。"],
  ["文风", "memory/style/voice.md", "叙事声音、节奏、视角、措辞和样本文段。"],
  ["禁忌", "memory/style/taboo.md", "需要避免的词语、套路、习惯和 AI 腔。"],
];

async function readMemoryFile(rootPath: string, relativePath: string) {
  try {
    return await fs.readFile(path.join(rootPath, relativePath), "utf8");
  } catch {
    return "";
  }
}

export default async function MemoryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const files = await Promise.all(
    memoryFiles.map(async ([title, relativePath, help]) => ({
      title,
      relativePath,
      help,
      content: await readMemoryFile(project.rootPath, relativePath),
    })),
  );

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <Link href={`/projects/${project.id}`} className="text-sm text-stone-500 transition hover:text-amber-200">
          返回工作台
        </Link>
        <header className="mt-4 flex flex-col gap-2 border-b border-stone-800 pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">记忆</p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-stone-400">
            直接在 Writeflow 中编辑本地 Markdown 记忆文件。Canon 设定请谨慎修改；进度和风格可以随每次运行演进。
          </p>
        </header>

        <section className="mt-6">
          <BlueprintGenerateForm projectId={project.id} generateAction={generateBlueprintForProject} />
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          {files.map((file) => (
            <MemoryFileCard
              key={file.relativePath}
              projectId={project.id}
              title={file.title}
              relativePath={file.relativePath}
              help={file.help}
              content={file.content}
              saveAction={updateProjectMemoryFile}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
