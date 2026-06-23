import Link from "next/link";

import type { ProjectView } from "./artifact-types";

export function WorkspaceShell({ children, project }: { children: React.ReactNode; project: ProjectView }) {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-stone-800 bg-stone-900/70 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm text-stone-500 transition hover:text-amber-200">
              Back to projects
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
            <p className="mt-1 text-sm text-stone-400">{project.description || "No description yet."}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-full bg-amber-300 px-4 py-2 text-stone-950" href={`/projects/${project.id}`}>
              Workspace
            </Link>
            <Link className="rounded-full border border-stone-700 px-4 py-2 text-stone-300" href={`/projects/${project.id}/memory`}>
              Memory
            </Link>
            <Link className="rounded-full border border-stone-700 px-4 py-2 text-stone-300" href={`/projects/${project.id}/runs`}>
              Runs
            </Link>
            <Link className="rounded-full border border-stone-700 px-4 py-2 text-stone-300" href={`/projects/${project.id}/settings`}>
              Settings
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
