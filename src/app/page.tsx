import Link from "next/link";

import { createProject, listProjects } from "./actions";

const projectTypeLabels = {
  novel: "小说续写",
  story_edit: "故事编辑",
  proposal: "方案规划",
};

const projectStatusLabels = {
  active: "进行中",
  archived: "已归档",
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
              人机协作写作工作台。
            </h1>
            <p className="mt-4 max-w-2xl text-stone-400">
              一套独立的多智能体写作协作系统，支持小说续写、故事编辑和方案规划。
            </p>
          </div>
          <Link
            href="/settings"
            className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            设置
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form action={createProject} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6 shadow-2xl shadow-black/20">
            <h2 className="text-xl font-semibold">新建项目</h2>
            <p className="mt-2 text-sm text-stone-400">创建本地优先项目，并自动初始化记忆模板。</p>

            <label className="mt-6 block text-sm text-stone-300" htmlFor="name">
              项目名称
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="玻璃之城"
              className="mt-2 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
            />

            <label className="mt-4 block text-sm text-stone-300" htmlFor="type">
              项目类型
            </label>
            <select
              id="type"
              name="type"
              defaultValue="novel"
              className="mt-2 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-300"
            >
              <option value="novel">小说续写</option>
              <option value="story_edit">故事编辑</option>
              <option value="proposal">方案规划</option>
            </select>

            <label className="mt-4 block text-sm text-stone-300" htmlFor="description">
              简要描述
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="用一句话描述项目目标。"
              className="mt-2 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
            />

            <button className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-medium text-stone-950 transition hover:bg-amber-200">
              创建项目
            </button>
          </form>

          <section className="rounded-3xl border border-stone-800 bg-stone-900/50 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">最近项目</h2>
              <span className="text-sm text-stone-500">{projects.length} 个项目</span>
            </div>

            <div className="mt-6 grid gap-4">
              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-700 p-8 text-center text-stone-500">
                  还没有项目。创建一个小说项目后会初始化记忆、产物和运行记录。
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
                      <span className="rounded-full bg-stone-800 px-3 py-1 text-xs text-stone-400">{projectStatusLabels[project.status]}</span>
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
