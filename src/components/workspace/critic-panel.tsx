"use client";

import { SubmitButton } from "@/components/forms/submit-button";

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

export function CriticPanel({
  reviewArtifacts,
  reviseAction,
}: {
  reviewArtifacts: ReviewArtifacts;
  reviseAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <StagePanel count={reviewArtifacts.length} empty="还没有审稿记录。闸门 3 选择终稿前，请先对草稿或润色稿运行审稿。" title="最新审稿记录">
      {reviewArtifacts.slice(0, 1).map(({ artifact, data }) => (
        <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
          {data ? (
            <form action={reviseAction} className="mt-3">
              <input type="hidden" name="projectId" value={artifact.projectId} />
              <input type="hidden" name="reviewArtifactId" value={artifact.id} />

              <p className="text-sm font-medium text-doc-accent">结论： {verdictLabels[data.verdict] ?? data.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-doc-text">{data.summary}</p>
              <p className="mt-2 text-xs text-doc-muted">推荐： {data.finalGateRecommendation}</p>

              {data.issues.length > 0 ? (
                <>
                  <p className="mt-4 text-xs text-doc-muted">勾选要修复的问题，然后运行修订（默认勾选阻断/主要问题）：</p>
                  <div className="mt-2 space-y-2">
                    {data.issues.map((issue, index) => (
                      <label key={`${issue.severity}-${index}`} className="flex cursor-pointer gap-3 rounded-lg border border-stone-200 bg-doc-card p-3 transition hover:border-stone-400">
                        <input
                          type="checkbox"
                          name="issueIndex"
                          value={index}
                          defaultChecked={issue.severity !== "minor"}
                          className="mt-1 h-4 w-4 shrink-0 accent-stone-900"
                        />
                        <span>
                          <span className="text-sm font-medium text-red-600">
                            {severityLabels[issue.severity] ?? issue.severity}
                            {issue.variantId ? ` · ${issue.variantId}` : ""}: {issue.problem}
                          </span>
                          {issue.location ? <span className="mt-1 block text-xs text-doc-muted">位置： {issue.location}</span> : null}
                          <span className="mt-1 block text-xs text-doc-muted">证据： {issue.evidence}</span>
                          <span className="mt-1 block text-xs text-doc-muted">修复建议： {issue.suggestedFix}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-doc-muted">修订会生成一份新的润色稿（成为最新），原版保留在历史与章节档案中。</p>
                    <SubmitButton
                      pendingText="修订中..."
                      processHint={{
                        agent: "编辑智能体",
                        description: "按勾选的审稿问题修订对应变体正文，生成新的润色版本。",
                        steps: ["读取审稿问题与被审正文", "按变体归组选中问题", "请求大模型逐变体修订", "保存修订版润色稿并刷新工作台"],
                        title: "按审稿修订",
                      }}
                      className="shrink-0 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      按选中问题修订
                    </SubmitButton>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-doc-muted">本次审稿未发现需要修复的问题。</p>
              )}
            </form>
          ) : (
            <p className="mt-3 text-sm text-doc-muted">无法读取审稿产物。</p>
          )}
        </article>
      ))}
    </StagePanel>
  );
}
