import Link from "next/link";

import { createProject, listProjects } from "./actions";

const projectTypeLabels = {
  novel: "Novel continuation",
  story_edit: "Story editing",
  proposal: "Proposal planning",
};

export default async function Home() {
  const projects = await listProjects();

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-4 border-b border-stone-800 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-amber-300">Writeflow</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
              Human-in-the-loop writing studio.
            </h1>
            <p className="mt-4 max-w-2xl text-stone-400">
              A standalone multi-agent workspace for novel continuation, story editing, and proposal planning.
            </p>
          </div>
          <Link
            href="/settings"
            className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            Settings
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form action={createProject} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6 shadow-2xl shadow-black/20">
            <h2 className="text-xl font-semibold">New project</h2>
            <p className="mt-2 text-sm text-stone-400">Create a local-first project with memory templates.</p>

            <label className="mt-6 block text-sm text-stone-300" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="The Glass City"
              className="mt-2 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
            />

            <label className="mt-4 block text-sm text-stone-300" htmlFor="type">
              Project type
            </label>
            <select
              id="type"
              name="type"
              defaultValue="novel"
              className="mt-2 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-300"
            >
              <option value="novel">Novel continuation</option>
              <option value="story_edit">Story editing</option>
              <option value="proposal">Proposal planning</option>
            </select>

            <label className="mt-4 block text-sm text-stone-300" htmlFor="description">
              Brief description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="A sentence about the project goal."
              className="mt-2 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
            />

            <button className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-medium text-stone-950 transition hover:bg-amber-200">
              Create project
            </button>
          </form>

          <section className="rounded-3xl border border-stone-800 bg-stone-900/50 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent projects</h2>
              <span className="text-sm text-stone-500">{projects.length} total</span>
            </div>

            <div className="mt-6 grid gap-4">
              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-700 p-8 text-center text-stone-500">
                  No projects yet. Create a novel project to initialize memory, artifacts, and runs.
                </div>
              ) : (
                projects.map((project) => (
                  <Link
                    href={`/projects/${project.id}`}
                    key={project.id}
                    className="group rounded-2xl border border-stone-800 bg-stone-950/70 p-5 transition hover:border-amber-300/70"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium group-hover:text-amber-200">{project.name}</h3>
                        <p className="mt-1 text-sm text-stone-500">{projectTypeLabels[project.type]}</p>
                      </div>
                      <span className="rounded-full bg-stone-800 px-3 py-1 text-xs text-stone-400">{project.status}</span>
                    </div>
                    {project.description ? <p className="mt-4 text-sm text-stone-400">{project.description}</p> : null}
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
