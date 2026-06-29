export function StagePanel({ children, count, empty, title }: { children: React.ReactNode; count: number; empty: React.ReactNode; title: string }) {
  return (
    <div className="rounded-3xl border border-stone-800 bg-stone-950/50 p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-stone-500">
          {count === 0 ? "0 条" : `当前 1 条 · 历史 ${Math.max(count - 1, 0)} 条`}
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {count === 0 ? <p className="rounded-2xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">{empty}</p> : children}
      </div>
    </div>
  );
}
