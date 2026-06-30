export function StagePanel({ children, count, empty, title }: { children: React.ReactNode; count: number; empty: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-doc-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-doc-text">{title}</h3>
        <span className="text-sm text-doc-muted">
          {count === 0 ? "0 条" : `当前 1 条 · 历史 ${Math.max(count - 1, 0)} 条`}
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {count === 0 ? <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-doc-muted">{empty}</p> : children}
      </div>
    </div>
  );
}
