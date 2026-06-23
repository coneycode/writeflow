import { runArchitectForProject, runMuseForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { DirectionArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function MusePanel({ directionArtifacts, projectId }: { directionArtifacts: DirectionArtifacts; projectId: string }) {
  return (
    <>
      <form action={runMuseForProject} className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Run Muse</h3>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Generate structured continuation directions from the local memory files. Requires OpenAI-compatible settings in `.env.local`.
            </p>
          </div>
          <SubmitButton pendingText="Running Muse..." className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
            Generate directions
          </SubmitButton>
        </div>
        <textarea
          name="brief"
          rows={4}
          placeholder="Optional brief: what should the next chapter explore?"
          className="mt-4 w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
        />
      </form>

      <StagePanel count={directionArtifacts.length} empty="No direction artifacts yet. Run Muse to create the first set of options." title="Latest Muse directions">
        {directionArtifacts.slice(0, 3).map(({ artifact, data }) => (
          <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
            <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
            <div className="mt-3 grid gap-3">
              {data?.options.map((option) => (
                <form key={option.id} action={runArchitectForProject} className="rounded-xl bg-stone-950 p-3">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="directionArtifactId" value={artifact.id} />
                  <input type="hidden" name="optionId" value={option.id} />
                  <p className="text-sm text-amber-300">Option {option.id}: {option.title}</p>
                  <p className="mt-2 text-sm text-stone-300">{option.coreMove}</p>
                  <p className="mt-2 text-xs text-stone-500">Next beat: {option.nextBeat}</p>
                  <SubmitButton pendingText="Outlining..." className="mt-3 rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                    Choose for Gate 1 and outline
                  </SubmitButton>
                </form>
              )) ?? <p className="text-sm text-stone-500">Unable to read artifact.</p>}
            </div>
            {data?.recommendation ? <p className="mt-3 text-sm text-stone-400">Recommendation: {data.recommendation}</p> : null}
          </article>
        ))}
      </StagePanel>
    </>
  );
}
