const memoryItems = ["State", "Characters", "World", "时间线", "开放线索", "文风", "禁忌"];

export function MemorySidebar() {
  return (
    <aside className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">记忆</p>
      <div className="mt-5 space-y-3">
        {memoryItems.map((item) => (
          <div key={item} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3">
            <p className="font-medium">{item}</p>
            <p className="mt-1 text-xs text-stone-500">已准备本地 Markdown 内容。</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
