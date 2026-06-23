import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import { SubmitButton } from "@/components/forms/submit-button";
import { notFound } from "next/navigation";

import { getProject, updateProjectMemoryFile } from "@/app/actions";

const memoryFiles = [
  ["Current state", "memory/progress/state.md", "Tracks where the story is now and what the next chapter should push."],
  ["Open threads", "memory/progress/open_threads.md", "Unresolved clues, promises, and planned payoffs."],
  ["World canon", "memory/canon/world.md", "Stable world rules, places, constraints, and canon facts."],
  ["Timeline", "memory/canon/timeline.md", "Established events in story order; use this to avoid continuity breaks."],
  ["Voice", "memory/style/voice.md", "Narrative voice, rhythm, POV, diction, and sample passages."],
  ["Taboos", "memory/style/taboo.md", "Words, tropes, habits, and AI-ish moves to avoid."],
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
          Back to workspace
        </Link>
        <header className="mt-4 flex flex-col gap-2 border-b border-stone-800 pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Memory</p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-stone-400">
            Edit local Markdown memory files directly from Writeflow. Canon edits should be deliberate; progress and style can evolve every run.
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
                <SubmitButton pendingText="Saving..." className="rounded-full bg-amber-300 px-4 py-2 text-xs font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
                  Save
                </SubmitButton>
              </div>
              <textarea
                name="content"
                defaultValue={file.content}
                rows={16}
                spellCheck={false}
                className="mt-4 w-full rounded-2xl border border-stone-800 bg-stone-950 p-4 font-mono text-sm leading-6 text-stone-300 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
                placeholder="Write Markdown memory here..."
              />
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}
