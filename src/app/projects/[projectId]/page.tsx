import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject, listDirectionArtifacts, listDraftArtifacts, listFinalArtifacts, listOutlineArtifacts, listReviewArtifacts, runArchitectForProject, runCriticForProject, runEditorForProject, runMuseForProject, runScribeForProject } from "@/app/actions";

const memoryItems = ["State", "Characters", "World", "Timeline", "Open threads", "Voice", "Taboos"];
const agentItems = ["Archivist", "Muse", "Architect", "Scribe", "Editor", "Critic"];

export default async function ProjectWorkspace({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const directionArtifacts = await listDirectionArtifacts(project.id);
  const outlineArtifacts = await listOutlineArtifacts(project.id);
  const draftArtifacts = await listDraftArtifacts(project.id);
  const finalArtifacts = await listFinalArtifacts(project.id);
  const reviewArtifacts = await listReviewArtifacts(project.id);

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

        <section className="grid min-h-[680px] gap-4 lg:grid-cols-[260px_1fr_300px]">
          <aside className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Memory</p>
            <div className="mt-5 space-y-3">
              {memoryItems.map((item) => (
                <div key={item} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3">
                  <p className="font-medium">{item}</p>
                  <p className="mt-1 text-xs text-stone-500">Ready for local Markdown content.</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Novel workflow</p>
                <h2 className="mt-2 text-2xl font-semibold">Continuation workspace</h2>
              </div>
              <button className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-medium text-stone-950 opacity-60" disabled>
                Start workflow soon
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <form action={runMuseForProject} className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Run Muse</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-400">
                      Generate structured continuation directions from the local memory files. Requires OpenAI-compatible settings in `.env.local`.
                    </p>
                  </div>
                  <button className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-amber-200">
                    Generate directions
                  </button>
                </div>
                <textarea
                  name="brief"
                  rows={4}
                  placeholder="Optional brief: what should the next chapter explore?"
                  className="mt-4 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
                />
              </form>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Gate 1", "Choose story direction"],
                  ["Gate 2", "Approve beat sheet"],
                  ["Gate 3", "Select final draft"],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                    <p className="text-sm text-amber-300">{title}</p>
                    <p className="mt-2 font-medium">{body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">Latest Muse directions</h3>
                  <span className="text-sm text-stone-500">{directionArtifacts.length} saved</span>
                </div>
                <div className="mt-4 space-y-4">
                  {directionArtifacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">
                      No direction artifacts yet. Run Muse to create the first set of options.
                    </p>
                  ) : (
                    directionArtifacts.slice(0, 3).map(({ artifact, data }) => (
                      <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                        <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
                        <div className="mt-3 grid gap-3">
                          {data?.options.map((option) => (
                            <form key={option.id} action={runArchitectForProject} className="rounded-xl bg-stone-950 p-3">
                              <input type="hidden" name="projectId" value={project.id} />
                              <input type="hidden" name="directionArtifactId" value={artifact.id} />
                              <input type="hidden" name="optionId" value={option.id} />
                              <p className="text-sm text-amber-300">Option {option.id}: {option.title}</p>
                              <p className="mt-2 text-sm text-stone-300">{option.coreMove}</p>
                              <p className="mt-2 text-xs text-stone-500">Next beat: {option.nextBeat}</p>
                              <button className="mt-3 rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950">
                                Choose for Gate 1 and outline
                              </button>
                            </form>
                          )) ?? <p className="text-sm text-stone-500">Unable to read artifact.</p>}
                        </div>
                        {data?.recommendation ? <p className="mt-3 text-sm text-stone-400">Recommendation: {data.recommendation}</p> : null}
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">Latest Architect outlines</h3>
                  <span className="text-sm text-stone-500">{outlineArtifacts.length} saved</span>
                </div>
                <div className="mt-4 space-y-4">
                  {outlineArtifacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">
                      No outlines yet. Choose a Muse option to generate the first beat sheet.
                    </p>
                  ) : (
                    outlineArtifacts.slice(0, 3).map(({ artifact, data }) => (
                      <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                        <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
                        {data ? (
                          <div className="mt-3">
                            <p className="text-sm text-amber-300">{data.chapterTitle}</p>
                            <p className="mt-2 text-sm text-stone-300">{data.chapterGoal}</p>
                            <form action={runScribeForProject} className="mt-3">
                              <input type="hidden" name="projectId" value={project.id} />
                              <input type="hidden" name="outlineArtifactId" value={artifact.id} />
                              <button className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950">
                                Approve Gate 2 and draft variants
                              </button>
                            </form>
                            <div className="mt-3 space-y-2">
                              {data.scenes.map((scene) => (
                                <div key={scene.id} className="rounded-xl bg-stone-950 p-3">
                                  <p className="text-sm font-medium text-stone-200">{scene.id}: {scene.title}</p>
                                  <p className="mt-1 text-xs text-stone-500">{scene.purpose}</p>
                                  <p className="mt-1 text-xs text-stone-500">Exit hook: {scene.exitHook}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-stone-500">Unable to read outline artifact.</p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">Latest Scribe drafts</h3>
                  <span className="text-sm text-stone-500">{draftArtifacts.length} saved</span>
                </div>
                <div className="mt-4 space-y-4">
                  {draftArtifacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">
                      No drafts yet. Approve an Architect outline to generate prose variants.
                    </p>
                  ) : (
                    draftArtifacts.slice(0, 3).map(({ artifact, data }) => (
                      <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                        <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
                        {data ? (
                          <div className="mt-3">
                            <p className="text-sm text-amber-300">{data.outlineTitle}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <form action={runEditorForProject}>
                                <input type="hidden" name="projectId" value={project.id} />
                                <input type="hidden" name="draftArtifactId" value={artifact.id} />
                                <button className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950">
                                  Run Editor polish
                                </button>
                              </form>
                              <form action={runCriticForProject}>
                                <input type="hidden" name="projectId" value={project.id} />
                                <input type="hidden" name="artifactId" value={artifact.id} />
                                <input type="hidden" name="artifactKind" value="draft" />
                                <button className="rounded-xl border border-red-300/60 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-300 hover:text-stone-950">
                                  Run Critic review
                                </button>
                              </form>
                            </div>
                            <div className="mt-3 grid gap-3">
                              {data.variants.map((variant) => (
                                <details key={variant.id} className="rounded-xl bg-stone-950 p-3">
                                  <summary className="cursor-pointer text-sm font-medium text-stone-200">
                                    Variant {variant.id}: {variant.title}
                                  </summary>
                                  <p className="mt-2 text-xs text-stone-500">Strategy: {variant.strategy}</p>
                                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-800 bg-stone-900 p-3 text-sm leading-6 text-stone-300">
                                    {variant.manuscript}
                                  </pre>
                                </details>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-stone-500">Unable to read draft artifact.</p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">Latest Editor polished drafts</h3>
                  <span className="text-sm text-stone-500">{finalArtifacts.length} saved</span>
                </div>
                <div className="mt-4 space-y-4">
                  {finalArtifacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">
                      No polished drafts yet. Run Editor on a Scribe draft to prepare Gate 3 selection.
                    </p>
                  ) : (
                    finalArtifacts.slice(0, 3).map(({ artifact, data }) => (
                      <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                        <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
                        {data ? (
                          <div className="mt-3">
                            <p className="text-sm text-amber-300">{data.sourceDraftTitle}</p>
                            <form action={runCriticForProject} className="mt-3">
                              <input type="hidden" name="projectId" value={project.id} />
                              <input type="hidden" name="artifactId" value={artifact.id} />
                              <input type="hidden" name="artifactKind" value="final" />
                              <button className="rounded-xl border border-red-300/60 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-300 hover:text-stone-950">
                                Run Critic on polished drafts
                              </button>
                            </form>
                            <div className="mt-3 grid gap-3">
                              {data.variants.map((variant) => (
                                <details key={variant.id} className="rounded-xl bg-stone-950 p-3">
                                  <summary className="cursor-pointer text-sm font-medium text-stone-200">
                                    {variant.id}: {variant.title}
                                  </summary>
                                  <p className="mt-2 text-xs text-stone-500">Edit strategy: {variant.editStrategy}</p>
                                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-800 bg-stone-900 p-3 text-sm leading-6 text-stone-300">
                                    {variant.manuscript}
                                  </pre>
                                </details>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-stone-500">Unable to read polished draft artifact.</p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">Latest Critic reviews</h3>
                  <span className="text-sm text-stone-500">{reviewArtifacts.length} saved</span>
                </div>
                <div className="mt-4 space-y-4">
                  {reviewArtifacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">
                      No reviews yet. Run Critic on drafts or polished drafts before Gate 3 final selection.
                    </p>
                  ) : (
                    reviewArtifacts.slice(0, 3).map(({ artifact, data }) => (
                      <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                        <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
                        {data ? (
                          <div className="mt-3">
                            <p className="text-sm text-amber-300">Verdict: {data.verdict}</p>
                            <p className="mt-2 text-sm text-stone-300">{data.summary}</p>
                            <p className="mt-2 text-xs text-stone-500">Recommendation: {data.finalGateRecommendation}</p>
                            <div className="mt-3 space-y-2">
                              {data.issues.map((issue, index) => (
                                <div key={`${issue.severity}-${index}`} className="rounded-xl bg-stone-950 p-3">
                                  <p className="text-sm font-medium text-red-200">{issue.severity.toUpperCase()}: {issue.problem}</p>
                                  <p className="mt-1 text-xs text-stone-500">Evidence: {issue.evidence}</p>
                                  <p className="mt-1 text-xs text-stone-500">Fix: {issue.suggestedFix}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-stone-500">Unable to read review artifact.</p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Agents</p>
            <div className="mt-5 space-y-3">
              {agentItems.map((agent) => (
                <div key={agent} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{agent}</p>
                    <span className="h-2 w-2 rounded-full bg-stone-600" />
                  </div>
                  <p className="mt-1 text-xs text-stone-500">Waiting for workflow engine.</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
