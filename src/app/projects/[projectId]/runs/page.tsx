import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "@/app/actions";

export default async function RunsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-5xl">
        <Link href={`/projects/${project.id}`} className="text-sm text-stone-500 transition hover:text-amber-200">
          Back to workspace
        </Link>
        <section className="mt-6 rounded-3xl border border-stone-800 bg-stone-900/70 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Run history</p>
          <h1 className="mt-3 text-3xl font-semibold">No runs yet</h1>
          <p className="mt-3 max-w-2xl text-stone-400">
            Future workflow runs will appear here with agent steps, gate choices, artifacts, and memory patches for replay and comparison.
          </p>
        </section>
      </div>
    </main>
  );
}
