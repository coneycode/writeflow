import type { ReviewArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function CriticPanel({ reviewArtifacts }: { reviewArtifacts: ReviewArtifacts }) {
  return (
    <StagePanel count={reviewArtifacts.length} empty="No reviews yet. Run Critic on drafts or polished drafts before Gate 3 final selection." title="Latest Critic reviews">
      {reviewArtifacts.slice(0, 3).map(({ artifact, data }) => (
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
      ))}
    </StagePanel>
  );
}
