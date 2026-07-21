import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject, listProjectRuns } from "@/app/actions";

const workflowLabels: Record<string, string> = {
  novel_continue: "小说续写",
};

const statusLabels: Record<string, string> = {
  completed: "已完成",
  failed: "失败",
  running: "运行中",
  waiting: "等待中",
  draft: "草稿",
  pending: "待处理",
};

const stepTypeLabels: Record<string, string> = {
  agent: "智能体",
  gate: "人工闸门",
  system: "系统",
};

const artifactKindLabels: Record<string, string> = {
  brief: "说明",
  recall: "记忆召回",
  direction: "方向",
  outline: "大纲",
  variant_strategy: "候选策略",
  draft: "草稿",
  edit: "润色稿",
  review: "审稿",
  final_selection: "终稿选择",
  selected_final: "已选终稿",
  memory_patch: "记忆补丁",
};

const currentStepLabels: Record<string, string> = {
  directions: "方向生成",
  outline: "大纲生成",
  drafting: "正文生成",
  editing: "润色",
  reviewing: "审稿",
  final_selection: "终稿选择",
  memory_patch: "记忆补丁",
  memory_apply: "应用记忆",
};

export default async function RunsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const runs = await listProjectRuns(project.id);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <Link href={`/projects/${project.id}`} className="text-sm text-stone-500 transition hover:text-amber-200">
          返回工作台
        </Link>
        <header className="mt-4 flex flex-col gap-2 border-b border-stone-800 pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">运行历史</p>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-stone-400">
            按时间展示本项目的工作流操作、生成产物以及闸门/系统步骤。
          </p>
        </header>

        <section className="mt-6 space-y-4">
          {runs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-700 bg-stone-900/60 p-8 text-stone-500">
              还没有运行记录。生成方向或继续工作流后会自动记录。
            </div>
          ) : (
            runs.map(({ artifacts, run, steps }) => (
              <article key={run.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs tracking-[0.25em] text-amber-300">{workflowLabels[run.workflow] ?? run.workflow}</p>
                    <h2 className="mt-2 text-xl font-semibold">{run.summary}</h2>
                    <p className="mt-1 font-mono text-xs text-stone-500">{run.id}</p>
                  </div>
                  <div className="text-left text-xs text-stone-500 md:text-right">
                    <p>状态： {statusLabels[run.status] ?? run.status}</p>
                    <p>步骤： {currentStepLabels[run.currentStep] ?? run.currentStep}</p>
                    <p>{run.createdAt.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                    <h3 className="text-sm font-medium text-stone-200">步骤</h3>
                    <div className="mt-3 space-y-3">
                      {steps.map((step) => (
                        <div key={step.id} className="rounded-xl bg-stone-900 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-stone-200">{step.title}</p>
                            <span className="rounded-full bg-stone-800 px-2 py-1 text-[11px] text-stone-400">{stepTypeLabels[step.stepType] ?? step.stepType}</span>
                          </div>
                          <p className="mt-1 text-xs text-stone-500">执行者： {step.agentId ?? "人类/系统"}</p>
                          <p className="mt-1 text-xs text-stone-500">状态： {statusLabels[step.status] ?? step.status}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                    <h3 className="text-sm font-medium text-stone-200">产物</h3>
                    <div className="mt-3 space-y-3">
                      {artifacts.length === 0 ? (
                        <p className="text-sm text-stone-500">这次运行没有关联产物。</p>
                      ) : (
                        artifacts.map((artifact) => (
                          <div key={artifact.id} className="rounded-xl bg-stone-900 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-stone-200">{artifact.title}</p>
                              <span className="rounded-full bg-stone-800 px-2 py-1 text-[11px] text-stone-400">{artifactKindLabels[artifact.kind] ?? artifact.kind}</span>
                            </div>
                            <p className="mt-2 break-all font-mono text-xs text-stone-500">{artifact.filePath}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
