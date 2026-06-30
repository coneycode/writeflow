import Link from "next/link";
import { notFound } from "next/navigation";

import { getChapterArchive, getProject } from "@/app/actions";
import { ChapterArchiveView } from "@/components/workspace/chapter-archive";

export default async function ChaptersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const chapters = await getChapterArchive(project.id);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-5xl">
        <Link href={`/projects/${project.id}`} className="text-sm text-stone-500 transition hover:text-amber-200">
          返回工作台
        </Link>
        <header className="mt-4 flex flex-col gap-2 border-b border-stone-800 pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">章节档案</p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-stone-400">
            按章节回看每一章的完整创作过程：已选方向、章节大纲、分段草稿、润色稿、审稿记录与终稿正文。
          </p>
        </header>

        <section className="mt-6 rounded-3xl border border-stone-200 bg-doc-surface p-5 text-doc-text shadow-xl shadow-black/30">
          <ChapterArchiveView chapters={chapters} />
        </section>
      </div>
    </main>
  );
}
