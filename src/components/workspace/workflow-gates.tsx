export function WorkflowGates() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["闸门 1", "选择故事方向"],
        ["闸门 2", "确认章节大纲"],
        ["闸门 3", "选择终稿"],
      ].map(([title, body]) => (
        <div key={title} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
          <p className="text-sm text-amber-300">{title}</p>
          <p className="mt-2 font-medium">{body}</p>
        </div>
      ))}
    </div>
  );
}
