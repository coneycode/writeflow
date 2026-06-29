import type { ReviewArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

const verdictLabels: Record<string, string> = {
  pass: "通过",
  revise: "需要修改",
  reject: "拒绝",
};

const severityLabels: Record<string, string> = {
  blocker: "阻断问题",
  major: "主要问题",
  minor: "次要问题",
};

export function CriticPanel({ reviewArtifacts }: { reviewArtifacts: ReviewArtifacts }) {
  return (
    <StagePanel count={reviewArtifacts.length} empty="还没有审稿记录。闸门 3 选择终稿前，请先对草稿或润色稿运行审稿。" title="最新审稿记录">
      {reviewArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-mono text-stone-500">{artifact.filePath}</p>
          {data ? (
            <div className="mt-3">
              <p className="text-sm text-amber-300">结论： {verdictLabels[data.verdict] ?? data.verdict}</p>
              <p className="mt-2 text-sm text-stone-300">{data.summary}</p>
              <p className="mt-2 text-xs text-stone-500">推荐： {data.finalGateRecommendation}</p>
              <div className="mt-3 space-y-2">
                {data.issues.map((issue, index) => (
                  <div key={`${issue.severity}-${index}`} className="rounded-xl bg-stone-950 p-3">
                    <p className="text-sm font-medium text-red-200">{severityLabels[issue.severity] ?? issue.severity}: {issue.problem}</p>
                    <p className="mt-1 text-xs text-stone-500">证据： {issue.evidence}</p>
                    <p className="mt-1 text-xs text-stone-500">修复建议： {issue.suggestedFix}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">无法读取审稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
