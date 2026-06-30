import type { ChapterArchive } from "@/app/actions";

import { CollapsibleProse } from "./collapsible-prose";

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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-doc-muted">{children}</p>;
}

function SubCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-doc-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-doc-accent">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ChapterArchiveView({ chapters }: { chapters: ChapterArchive[] }) {
  if (chapters.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-sm text-doc-muted">
        还没有已选终稿。完成第一章的终稿选择后，这里会按章节归档完整的创作过程。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {chapters.map((chapter, position) => (
        <details key={chapter.chapterId} className="overflow-hidden rounded-2xl border-2 border-stone-300 bg-stone-50 shadow-sm" open={position === chapters.length - 1}>
          <summary className="flex cursor-pointer items-center gap-3 border-b border-stone-200 bg-doc-card px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
              {chapter.index}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-stone-900">第 {chapter.index} 章：{chapter.title}</span>
              <span className="block truncate text-xs text-doc-muted">{chapter.selectionNote}</span>
            </span>
          </summary>

          <div className="space-y-3 p-4">
            <SubCard title="已选方向">
              {chapter.direction?.option ? (
                <div className="space-y-2 text-sm leading-6 text-doc-text">
                  <p className="font-medium text-doc-text">{chapter.direction.option.title}</p>
                  <p>{chapter.direction.option.coreMove}</p>
                  <p className="text-xs text-doc-muted">下一拍：{chapter.direction.option.nextBeat}</p>
                </div>
              ) : chapter.direction ? (
                <p className="text-sm leading-6 text-doc-text">{chapter.direction.recommendation || "已选方向（无法定位具体选项）。"}</p>
              ) : (
                <Empty>该章无方向记录。</Empty>
              )}
            </SubCard>

            <SubCard title="章节大纲">
              {chapter.outline ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-doc-text">{chapter.outline.chapterTitle}</p>
                    <p className="mt-1 text-sm leading-6 text-doc-text">{chapter.outline.chapterGoal}</p>
                  </div>
                  <div className="space-y-2">
                    {chapter.outline.scenes.map((scene, index) => (
                      <div key={`${scene.id}-${index}`} className="rounded-lg bg-stone-50 p-3">
                        <p className="text-xs text-doc-accent">{scene.id} · 第 {index + 1} 场</p>
                        <p className="mt-1 text-sm font-medium text-doc-text">{scene.title}</p>
                        <p className="mt-1 text-sm leading-6 text-doc-text">{scene.purpose}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty>该章无大纲记录。</Empty>
              )}
            </SubCard>

            <SubCard title="分段草稿">
              {chapter.draft ? (
                <div className="space-y-3">
                  {chapter.draft.variants.map((variant) => (
                    <details key={variant.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-doc-text">
                        变体 {variant.id}：{variant.title}
                      </summary>
                      <div className="mt-2 space-y-3">
                        {variant.segments.map((segment, index) => (
                          <div key={`${variant.id}-${segment.sceneId}`}>
                            <p className="text-xs font-medium text-stone-900">{segment.sceneId} · 第 {index + 1} 场：{segment.sceneTitle}</p>
                            <div className="mt-1">
                              <CollapsibleProse text={segment.manuscript} fade="stone" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <Empty>该章无草稿记录。</Empty>
              )}
            </SubCard>

            <SubCard title="润色稿">
              {chapter.edit ? (
                <div className="space-y-3">
                  {chapter.edit.variants.map((variant) => (
                    <details key={variant.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-doc-text">
                        {variant.id}：{variant.title}
                      </summary>
                      <div className="mt-2">
                        <CollapsibleProse text={variant.manuscript} fade="stone" />
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <Empty>该章无润色记录。</Empty>
              )}
            </SubCard>

            <SubCard title="审稿记录">
              {chapter.reviews.length > 0 ? (
                <div className="space-y-3">
                  {chapter.reviews.map((review, index) => (
                    <div key={index} className="rounded-lg bg-stone-50 p-3">
                      {review.data ? (
                        <>
                          <p className="text-sm font-medium text-doc-accent">结论：{verdictLabels[review.data.verdict] ?? review.data.verdict}</p>
                          <p className="mt-1 text-sm leading-6 text-doc-text">{review.data.summary}</p>
                          <div className="mt-2 space-y-1.5">
                            {review.data.issues.map((issue, issueIndex) => (
                              <p key={issueIndex} className="text-xs text-doc-muted">
                                <span className="font-medium text-red-600">{severityLabels[issue.severity] ?? issue.severity}</span>：{issue.problem}
                              </p>
                            ))}
                          </div>
                        </>
                      ) : (
                        <Empty>审稿产物无法读取。</Empty>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>该章无审稿记录。</Empty>
              )}
            </SubCard>

            <SubCard title="终稿正文">
              <CollapsibleProse text={chapter.manuscript} fade="card" />
            </SubCard>
          </div>
        </details>
      ))}
    </div>
  );
}
