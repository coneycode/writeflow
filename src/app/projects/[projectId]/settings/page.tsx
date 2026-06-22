import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "@/app/actions";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
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
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Project settings</p>
          <h1 className="mt-3 text-3xl font-semibold">{project.name}</h1>
          <div className="mt-6 grid gap-4 text-sm text-stone-400 md:grid-cols-2">
            <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
              <p className="text-stone-200">Project root</p>
              <p className="mt-2 break-all font-mono text-xs">{project.rootPath}</p>
            </div>
            <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
              <p className="text-stone-200">Workflow type</p>
              <p className="mt-2">{project.type}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
