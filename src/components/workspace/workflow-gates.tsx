export function WorkflowGates() {
  return (
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
  );
}
