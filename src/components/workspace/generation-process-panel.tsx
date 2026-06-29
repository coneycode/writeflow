"use client";

import { useEffect, useMemo, useState } from "react";

type GenerationProcessDetail = {
  agent: string;
  description: string;
  steps?: string[];
  title: string;
};

type GenerationProcessState = GenerationProcessDetail & {
  startedAt: number;
  status: "running" | "idle";
};

const defaultSteps = ["整理上下文", "请求大模型", "解析结构化结果", "写入项目文件", "刷新工作台"];

function formatDuration(startedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} 秒`;
  }

  return `${minutes} 分 ${remainingSeconds} 秒`;
}

export function GenerationProcessPanel() {
  const [process, setProcess] = useState<GenerationProcessState | null>(null);
  const [elapsed, setElapsed] = useState("0 秒");
  const steps = useMemo(() => process?.steps?.filter(Boolean) ?? defaultSteps, [process?.steps]);

  useEffect(() => {
    function handleStart(event: Event) {
      const detail = (event as CustomEvent<GenerationProcessDetail>).detail;
      setProcess({ ...detail, startedAt: Date.now(), status: "running" });
      setElapsed("0 秒");
    }

    function handleEnd() {
      setProcess((current) => (current ? { ...current, status: "idle" } : current));
    }

    window.addEventListener("writeflow:generation-start", handleStart);
    window.addEventListener("writeflow:generation-end", handleEnd);

    return () => {
      window.removeEventListener("writeflow:generation-start", handleStart);
      window.removeEventListener("writeflow:generation-end", handleEnd);
    };
  }, []);

  useEffect(() => {
    if (!process || process.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsed(formatDuration(process.startedAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [process]);

  if (!process) {
    return null;
  }

  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border border-amber-300/30 bg-stone-950/95 p-4 text-stone-100 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">生成过程</p>
          <h2 className="mt-2 text-lg font-semibold">{process.title}</h2>
        </div>
        <span className="rounded-full border border-green-300/40 px-2 py-1 text-xs text-green-200">
          {process.status === "running" ? "运行中" : "已提交"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-900/80 p-3 text-sm text-stone-300">
        <p className="text-stone-100">{process.agent}</p>
        <p className="mt-1 leading-6">{process.description}</p>
        <p className="mt-2 text-xs text-stone-500">已耗时：{elapsed}</p>
      </div>

      <ol className="mt-4 space-y-2 text-sm text-stone-300">
        {steps.map((step, index) => (
          <li key={`${step}-${index}`} className="flex gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        当前版本展示提交后的关键阶段。若模型接口支持流式输出，可继续扩展为实时词元和原始响应预览。
      </p>
    </aside>
  );
}
