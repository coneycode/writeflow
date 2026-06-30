"use client";

import type { StageKey, StageStatus } from "./workspace-stage";

function StateDot({ state }: { state: StageStatus["state"] }) {
  if (state === "done") {
    return <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />;
  }

  if (state === "current") {
    return <span className="stage-pulse mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" />;
  }

  return <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-stone-600 bg-transparent" />;
}

export function StageRail({
  stages,
  activeStage,
  onSelect,
}: {
  stages: StageStatus[];
  activeStage: StageKey;
  onSelect: (key: StageKey) => void;
}) {
  return (
    <aside className="flex flex-col rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
      <p className="px-2 text-xs uppercase tracking-[0.3em] text-stone-500">工作流</p>
      <nav className="mt-4 flex flex-col gap-1">
        {stages.map((stage, position) => {
          const isActive = stage.key === activeStage;
          const isLocked = stage.state === "locked";
          const isLast = position === stages.length - 1;

          return (
            <div key={stage.key} className="relative">
              {!isLast ? (
                <span
                  aria-hidden
                  className={`absolute left-[18px] top-8 h-[calc(100%-12px)] w-px ${stage.state === "done" ? "bg-green-400/40" : "bg-stone-800"}`}
                />
              ) : null}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onSelect(stage.key)}
                aria-current={isActive ? "step" : undefined}
                className={`group flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition ${
                  isActive ? "bg-amber-300/10 ring-1 ring-amber-300/40" : "hover:bg-stone-800/60"
                } ${isLocked ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    stage.state === "done"
                      ? "bg-green-400/15 text-green-300"
                      : stage.state === "current"
                        ? "bg-amber-300/15 text-amber-200"
                        : "bg-stone-800 text-stone-500"
                  }`}
                >
                  {stage.index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? "text-amber-100" : "text-stone-200"}`}>{stage.name}</span>
                    <StateDot state={stage.state} />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-stone-500">{stage.summary}</span>
                </span>
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
