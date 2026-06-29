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
    if (!processHint || typeof window === "undefined") {
      return;
    }

    if (pending) {
      announcedRef.current = true;
      return;
    }

    if (announcedRef.current) {
      window.dispatchEvent(new CustomEvent("writeflow:generation-end"));
      announcedRef.current = false;
    }
  }, [pending, processHint]);

  function announceProcess() {
    if (!processHint || typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new CustomEvent("writeflow:generation-start", { detail: processHint }));
  }

  return (
    <button className={className} disabled={pending} aria-disabled={pending} onClick={announceProcess}>
      {pending ? pendingText : children}
    </button>
  );
}
