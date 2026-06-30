"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RunStepStatus = "running" | "completed" | "failed";
type RunStatus = "running" | "completed" | "failed" | "interrupted" | "cancelled" | "missing";

type RunStep = {
  id: string;
  agent: string;
  label: string;
  status: RunStepStatus;
  promptPreview: string;
  output: string;
  startedAt: string;
  endedAt?: string;
};

type RunState = {
  runId: string;
  title: string;
  status: RunStatus;
  startedAt: string;
  updatedAt: string;
  error?: string;
  steps: RunStep[];
};

const statusLabels: Record<RunStatus, string> = {
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  interrupted: "已中断",
  cancelled: "已中止",
  missing: "无记录",
};

function elapsedLabel(startedAt: string, endedAt?: string) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes === 0 ? `${rest} 秒` : `${minutes} 分 ${rest} 秒`;
}

function StepDot({ status }: { status: RunStepStatus }) {
  if (status === "completed") {
    return <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-400" />;
  }
  if (status === "failed") {
    return <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-400" />;
  }
  return <span className="stage-pulse mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300" />;
}

function StepCard({ step, defaultOpen }: { step: RunStep; defaultOpen: boolean }) {
  const outputRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    // 当前运行步骤：输出自动滚到底，跟随逐字流。
    if (step.status === "running" && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [step.output, step.status]);

  return (
    <details open={defaultOpen} className="rounded-xl border border-stone-800 bg-stone-950/70 p-3">
      <summary className="flex cursor-pointer items-start justify-between gap-2">
        <span className="flex items-start gap-2">
          <StepDot status={step.status} />
          <span>
            <span className="text-xs font-medium text-stone-200">{step.label}</span>
            <span className="mt-0.5 block text-[11px] text-stone-500">{step.agent}</span>
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-stone-500">{elapsedLabel(step.startedAt, step.endedAt)}</span>
      </summary>

      {step.promptPreview ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-stone-500">发送内容（节选）</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-stone-800 bg-stone-900/70 p-2 text-[11px] leading-5 text-stone-400">
            {step.promptPreview}
          </pre>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-[11px] font-medium text-stone-500">模型输出{step.status === "running" ? "（生成中…）" : ""}</p>
        <pre
          ref={outputRef}
          className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-stone-800 bg-stone-900/70 p-2 text-[11px] leading-5 text-stone-300"
        >
          {step.output || (step.status === "running" ? "…" : "（无输出）")}
        </pre>
      </div>
    </details>
  );
}

export function GenerationProcessPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState<RunState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [, forceTick] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const connectedRunRef = useRef<string | null>(null);
  const refreshedRef = useRef<string | null>(null);
  // 已到达终态（完成/失败/缺失）的 runId，避免结束后还重连。
  const settledRef = useRef<string | null>(null);
  // 持有最新 connect，供 onerror 重连时调用，避免 useCallback 自引用依赖循环。
  const connectRef = useRef<((runId: string) => void) | null>(null);

  const connect = useCallback((runId: string) => {
    if (connectedRunRef.current === runId && sourceRef.current) {
      return;
    }
    sourceRef.current?.close();
    connectedRunRef.current = runId;

    const source = new EventSource(`/api/projects/${projectId}/runs/${runId}/stream`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as RunState & { status: RunStatus };
        // state.json 不存在等异常 payload（如 {status:"missing"}）没有 steps，
        // 不当作有效进度状态，直接关闭重连。
        if (!Array.isArray(next.steps)) {
          // 异常 payload（如 {status:"missing"}）：标记终态，不再重连。
          settledRef.current = runId;
          source.close();
          sourceRef.current = null;
          connectedRunRef.current = null;
          return;
        }
        setState(next);
        if (next.status !== "running") {
          settledRef.current = next.runId;
          source.close();
          sourceRef.current = null;
          connectedRunRef.current = null;
          // 完成后拉取新产物（后台任务不能调 revalidatePath）。
          if (next.status === "completed" && refreshedRef.current !== next.runId) {
            refreshedRef.current = next.runId;
            router.refresh();
          }
        }
      } catch {
        // 忽略解析失败的片段
      }
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      connectedRunRef.current = null;
      // 任务尚未结束就断连（长任务期间连接易被中间层掐断）：延迟重连同一 run。
      // stream 路由对已完成的 run 会立即推终态再关闭，因此重连也能补到“完成”。
      if (settledRef.current !== runId) {
        setTimeout(() => {
          if (settledRef.current !== runId && connectedRunRef.current !== runId) {
            connectRef.current?.(runId);
          }
        }, 1000);
      }
    };
  }, [projectId, router]);

  // 保持 connectRef 指向最新 connect（供 onerror 重连调用）。
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // 轮询兜底：running 期间每 5 秒查一次最新状态。长任务的 SSE 连接可能被中间层
  // 静默掐断而不触发 onerror，导致“完成”消息丢失、面板卡在运行中；轮询保证终态总会被收到。
  useEffect(() => {
    if (state?.status !== "running") {
      return;
    }
    const runId = state.runId;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/runs/${runId}/state`, { cache: "no-store" });
        const data = (await response.json()) as { state: (RunState & { status: RunStatus }) | null };
        const next = data.state;
        if (next && Array.isArray(next.steps)) {
          setState(next);
          if (next.status !== "running") {
            settledRef.current = next.runId;
            sourceRef.current?.close();
            sourceRef.current = null;
            connectedRunRef.current = null;
            if (next.status === "completed" && refreshedRef.current !== next.runId) {
              refreshedRef.current = next.runId;
              router.refresh();
            }
          }
        }
      } catch {
        // 忽略，等待下次轮询
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [state?.status, state?.runId, projectId, router]);

  const findActive = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/active-run`, { cache: "no-store" });
      const data = (await response.json()) as { runId: string | null; state: RunState | null };
      if (data.runId) {
        if (data.state) {
          setState(data.state);
        }
        connect(data.runId);
      }
    } catch {
      // 网络异常忽略，等待下次触发
    }
  }, [projectId, connect]);

  // 挂载即尝试恢复正在运行的 run（刷新后不丢）。延到下一拍执行，
  // 避免在 effect 体内同步触发 setState。
  useEffect(() => {
    const timer = setTimeout(() => {
      void findActive();
    }, 0);
    return () => {
      clearTimeout(timer);
      sourceRef.current?.close();
    };
  }, [findActive]);

  // 按钮提交后，轮询几次抓住新建的 run（server action 返回与 run 落库存在轻微时序差）。
  useEffect(() => {
    function handleSubmitted() {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        void findActive();
        if (attempts >= 6 || connectedRunRef.current) {
          clearInterval(timer);
        }
      }, 500);
    }

    function handleSettled() {
      void findActive();
    }

    window.addEventListener("writeflow:job-submitted", handleSubmitted);
    window.addEventListener("writeflow:job-settled", handleSettled);
    return () => {
      window.removeEventListener("writeflow:job-submitted", handleSubmitted);
      window.removeEventListener("writeflow:job-settled", handleSettled);
    };
  }, [findActive]);

  // running 时每秒刷新一次耗时显示。
  useEffect(() => {
    if (state?.status !== "running") {
      return;
    }
    const timer = setInterval(() => forceTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [state?.status]);

  // 切换到非 running 状态时重置中止态（延到下一拍，避免在 effect 体内同步 setState）。
  useEffect(() => {
    if (state?.status === "running") {
      return;
    }
    const timer = setTimeout(() => setCancelling(false), 0);
    return () => clearTimeout(timer);
  }, [state?.status]);

  const handleCancel = useCallback(async () => {
    if (!state || state.status !== "running") {
      return;
    }
    setCancelling(true);
    try {
      await fetch(`/api/projects/${projectId}/runs/${state.runId}/cancel`, { method: "POST" });
      // 中止后状态由 SSE / 轮询更新为 cancelled；这里不直接改 state。
    } catch {
      setCancelling(false);
    }
  }, [projectId, state]);

  if (!state) {
    return (
      <section className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
        <p className="text-sm font-medium text-stone-200">生成过程</p>
        <p className="mt-2 text-xs leading-5 text-stone-500">触发任意生成操作后，这里会实时显示当前智能体、逐字输出与每步耗时；刷新页面也不会丢失。</p>
      </section>
    );
  }

  const steps = state.steps ?? [];
  const runningStepId = [...steps].reverse().find((step) => step.status === "running")?.id;
  const accentBorder = state.status === "failed" || state.status === "cancelled" ? "border-red-400/40" : state.status === "running" ? "border-amber-300/30" : "border-stone-800";

  return (
    <section className={`rounded-2xl border ${accentBorder} bg-stone-900/80 p-4 text-stone-100`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">生成过程</p>
          <h2 className="mt-1.5 text-base font-semibold">{state.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[11px] ${
              state.status === "failed" || state.status === "cancelled"
                ? "border-red-300/40 text-red-200"
                : state.status === "completed"
                  ? "border-green-300/40 text-green-200"
                  : "border-amber-300/40 text-amber-200"
            }`}
          >
            {statusLabels[state.status]}
          </span>
          {state.status === "running" ? (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-full border border-red-300/50 px-2.5 py-1 text-[11px] font-medium text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelling ? "中止中…" : "中止"}
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-stone-500">
        共 {steps.length} 步 · 总耗时 {elapsedLabel(state.startedAt, state.status === "running" ? undefined : state.updatedAt)}
      </p>

      {state.error ? (
        <p className="mt-2 rounded-lg border border-red-400/30 bg-red-950/30 p-2 text-[11px] leading-5 text-red-200">{state.error}</p>
      ) : state.status === "interrupted" ? (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-950/30 p-2 text-[11px] leading-5 text-amber-200">
          任务超过 2 分钟没有进展，可能是后台进程被中断或模型请求超时。可重新触发本步骤；若反复中断，请检查模型接口与超时配置。
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {steps.length === 0 ? (
          <p className="text-xs text-stone-500">正在准备…</p>
        ) : (
          steps.map((step) => <StepCard key={step.id} step={step} defaultOpen={step.id === runningStepId} />)
        )}
      </div>
    </section>
  );
}
