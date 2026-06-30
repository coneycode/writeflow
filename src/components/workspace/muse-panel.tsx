import { runArchitectForProject, runMuseForProject } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

import type { DirectionArtifacts } from "./artifact-types";
import { StagePanel } from "./stage-panel";

export function MusePanel({ directionArtifacts, projectId }: { directionArtifacts: DirectionArtifacts; projectId: string }) {
  const latestBrief = directionArtifacts[0]?.data?.brief ?? "";
  return (
    <div className="space-y-4">
      <form action={runMuseForProject} className="rounded-2xl border border-stone-200 bg-doc-card p-5">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-doc-text">运行构思师</h3>
            <p className="mt-2 text-sm leading-6 text-doc-muted">
              根据本地记忆文件生成结构化续写方向。需要先在 `.env.local` 配置 OpenAI 兼容模型。
            </p>
          </div>
          <SubmitButton
            pendingText="构思中..."
            processHint={{
              agent: "构思师",
              description: "读取续写上文和本地记忆，生成多个可选续写方向。",
              steps: ["读取续写上文", "召回项目记忆", "组织方向提示词", "请求大模型生成候选方向", "保存方向产物并刷新工作台"],
              title: "生成续写方向",
            }}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            生成方向
          </SubmitButton>
        </div>
        <textarea
          name="brief"
          rows={3}
          defaultValue={latestBrief}
          placeholder="可选说明：下一章希望探索什么？"
          className="mt-4 w-full rounded-xl border border-stone-300 bg-doc-card px-4 py-3 text-sm text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
        />
      </form>

      <StagePanel count={directionArtifacts.length} empty="还没有方向产物。运行构思师创建第一组候选方向。" title="最新方向">
        {directionArtifacts.slice(0, 1).map(({ artifact, data }) => (
          <article key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-mono text-stone-400">{artifact.filePath}</p>
            {data?.brief ? (
              <div className="mt-3 rounded-lg border border-stone-200 bg-doc-card p-3">
                <p className="text-xs font-medium text-doc-muted">构思记录（本次输入说明）</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-doc-text">{data.brief}</p>
              </div>
            ) : null}
            <div className="mt-3 grid gap-3">
              {data?.options.map((option) => (
                <form key={option.id} action={runArchitectForProject} className="rounded-xl border border-stone-200 bg-doc-card p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="directionArtifactId" value={artifact.id} />
                  <input type="hidden" name="optionId" value={option.id} />
                  <p className="text-sm font-medium text-doc-accent">选项 {option.id}: {option.title}</p>
                  <p className="mt-2 text-sm leading-6 text-doc-text">{option.coreMove}</p>
                  <p className="mt-2 text-xs text-doc-muted">下一拍： {option.nextBeat}</p>
                  <SubmitButton
                    pendingText="生成大纲中..."
                    processHint={{
                      agent: "架构师",
                      description: "把选中的方向拆成章节目标、场景节拍和连续性检查。",
                      steps: ["读取已选方向", "读取续写上文", "召回结构记忆", "请求大模型生成章节大纲", "保存大纲产物并刷新工作台"],
                      title: "生成章节大纲",
                    }}
                    className="mt-3 rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    选为闸门 1 方向并生成大纲
                  </SubmitButton>
                </form>
              )) ?? <p className="text-sm text-doc-muted">无法读取产物。</p>}
            </div>
            {data?.recommendation ? <p className="mt-3 text-sm text-doc-muted">推荐： {data.recommendation}</p> : null}
          </article>
        ))}
      </StagePanel>
    </div>
  );
}
