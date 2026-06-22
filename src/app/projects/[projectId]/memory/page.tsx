import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "@/app/actions";

const memoryFiles = [
  ["Current state", "memory/progress/state.md"],
  ["Open threads", "memory/progress/open_threads.md"],
  ["World canon", "memory/canon/world.md"],
  ["Timeline", "memory/canon/timeline.md"],
  ["Voice", "memory/style/voice.md"],
  ["Taboos", "memory/style/taboo.md"],
];

async function readSnippet(rootPath: string, relativePath: string) {
  try {
    const content = await fs.readFile(path.join(rootPath, relativePath), "utf8");
    return content.trim() || "Empty file.";
  } catch {
    return "Not initialized yet.";
  }
}

export default async function MemoryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const files = await Promise.all(
    memoryFiles.map(async ([title, relativePath]) => ({
      title,
      relativePath,
      content: await readSnippet(project.rootPath, relativePath),
    })),
  );

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <Link href={`/projects/${project.id}`} className="text-sm text-stone-500 transition hover:text-amber-200">
          Back to workspace
        </Link>
        <header className="mt-4 flex flex-col gap-2 border-b border-stone-800 pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Memory</p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-stone-400">Local Markdown memory files. Canon edits should be deliberate; progress and style can evolve every run.</p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {files.map((file) => (
            <article key={file.relativePath} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{file.title}</h2>
                  <p className="mt-1 font-mono text-xs text-stone-500">{file.relativePath}</p>
                </div>
                <span className="rounded-full bg-stone-800 px-3 py-1 text-xs text-stone-400">read only</span>
              </div>
              <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-950 p-4 text-sm leading-6 text-stone-300">
                {file.content}
              </pre>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
