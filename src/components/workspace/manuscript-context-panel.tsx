import { updateProjectManuscriptContext } from "@/app/actions";
import { SubmitButton } from "@/components/forms/submit-button";

type Variant = "doc" | "rail";

export function ManuscriptContextPanel({
  content,
  projectId,
  variant = "doc",
}: {
  content: string;
  projectId: string;
  variant?: Variant;
}) {
  if (variant === "rail") {
    return (
      <form action={updateProjectManuscriptContext} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <textarea
          name="content"
          defaultValue={content}
          rows={8}
          placeholder="粘贴要续写的上文原文。没有上文时不会运行续写。"
          className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-xs leading-6 text-stone-200 outline-none transition placeholder:text-stone-600 focus:border-amber-300/60"
        />
        <SubmitButton
          pendingText="保存中..."
          className="w-full rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          保存上文
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={updateProjectManuscriptContext} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-doc-text">续写上文</h3>
          <p className="mt-1 text-sm leading-6 text-doc-muted">
            所有续写步骤都会基于这里的上文原文。请粘贴上一章、最近几段，或要紧接着续写的片段。
          </p>
        </div>
        <SubmitButton
          pendingText="保存上文中..."
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          保存上文
        </SubmitButton>
      </div>
      <textarea
        name="content"
        defaultValue={content}
        rows={14}
        placeholder="把需要续写的上文原文粘贴到这里。没有上文时，系统不会运行续写。"
        className="mt-4 w-full rounded-xl border border-stone-300 bg-doc-card px-4 py-3 text-sm leading-7 text-doc-text outline-none transition placeholder:text-stone-400 focus:border-stone-400"
      />
    </form>
  );
}
