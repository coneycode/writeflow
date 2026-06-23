const agentItems = ["Archivist", "Muse", "Architect", "Scribe", "Editor", "Critic"];

export function AgentSidebar() {
  return (
    <aside className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">智能体</p>
      <div className="mt-5 space-y-3">
        {agentItems.map((agent) => (
          <div key={agent} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{agent}</p>
              <span className="h-2 w-2 rounded-full bg-stone-600" />
            </div>
            <p className="mt-1 text-xs text-stone-500">等待工作流执行。</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
