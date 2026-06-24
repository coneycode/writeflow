import { updateProjectManuscriptContext } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

export function ManuscriptContextPanel({ content, projectId }: { content: string; projectId: string }) {
  return (
    <form action={updateProjectManuscriptContext} className="rounded-3xl border border-amber-300/30 bg-amber-950/20 p-6">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-amber-100">续写上文</h3>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            所有续写步骤都会基于这里的上文原文。请粘贴上一章、最近几段，或要紧接着续写的片段。
          </p>
        </div>
        <SubmitButton pendingText="保存上文中..." className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
          保存上文
        </SubmitButton>
      </div>
      <textarea
        name="content"
        defaultValue={content}
        rows={12}
        placeholder="把需要续写的上文原文粘贴到这里。没有上文时，系统不会运行续写。"
        className="mt-4 w-full rounded-2xl border border-amber-300/20 bg-stone-950 px-4 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
      />
    </form>
  );
}
