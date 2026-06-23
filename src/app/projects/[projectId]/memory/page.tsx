import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import { SubmitButton } from "@/components/forms/submit-button";
import { notFound } from "next/navigation";

import { getProject, updateProjectMemoryFile } from "@/app/actions";

const memoryFiles = [
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

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {files.map((file) => (
            <form key={file.relativePath} action={updateProjectMemoryFile} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="target" value={file.relativePath} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{file.title}</h2>
                  <p className="mt-1 font-mono text-xs text-stone-500">{file.relativePath}</p>
                  <p className="mt-2 text-xs leading-5 text-stone-500">{file.help}</p>
                </div>
                <SubmitButton pendingText="保存中..." className="rounded-full bg-amber-300 px-4 py-2 text-xs font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
                  保存
                </SubmitButton>
              </div>
              <textarea
                name="content"
                defaultValue={file.content}
                rows={16}
                spellCheck={false}
                className="mt-4 w-full rounded-2xl border border-stone-800 bg-stone-950 p-4 font-mono text-sm leading-6 text-stone-300 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
                placeholder="在这里写 Markdown 记忆..."
              />
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}
