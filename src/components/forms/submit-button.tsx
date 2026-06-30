"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

type ProcessHint = {
  agent: string;
  description: string;
  steps?: string[];
  title: string;
};

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  processHint?: ProcessHint;
};

export function SubmitButton({ children, pendingText = "处理中...", className, processHint }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const announcedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // 表单进入 pending：任务已提交到后台。通知生成面板开始查找活跃 run。
    if (pending && !announcedRef.current) {
      announcedRef.current = true;
      window.dispatchEvent(new CustomEvent("writeflow:job-submitted", { detail: processHint ?? null }));
      return;
    }

    // pending 结束：server action 已返回（后台任务可能仍在跑）。再戳一次，确保面板抓到 runId。
    if (!pending && announcedRef.current) {
      announcedRef.current = false;
      window.dispatchEvent(new CustomEvent("writeflow:job-settled"));
    }
  }, [pending, processHint]);

  return (
    <button className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
