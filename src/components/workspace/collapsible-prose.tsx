"use client";

import { useEffect, useRef, useState } from "react";

type FadeTone = "card" | "stone";

const fadeClass: Record<FadeTone, string> = {
  // 渐隐颜色需匹配所在卡片底色，避免出现色块。
  card: "from-doc-card",
  stone: "from-stone-50",
};

/**
 * 可折叠长文：超过 collapsedHeight 时默认折叠，底部渐隐 + “展开全文/收起”。
 * 内容不超高时不显示按钮、不加遮罩。
 */
export function CollapsibleProse({
  text,
  className = "doc-prose text-[15px]",
  collapsedHeight = 320,
  fade = "card",
}: {
  text: string;
  className?: string;
  collapsedHeight?: number;
  fade?: FadeTone;
}) {
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const measure = () => setOverflowing(el.scrollHeight > collapsedHeight + 8);
    measure();
    // 字体/布局变化后重新测量。
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, collapsedHeight]);

  const collapsed = overflowing && !expanded;

  return (
    <div>
      <div className="relative">
        <p
          ref={contentRef}
          className={className}
          style={collapsed ? { maxHeight: collapsedHeight, overflow: "hidden" } : undefined}
        >
          {text}
        </p>
        {collapsed ? (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${fadeClass[fade]} to-transparent`} />
        ) : null}
      </div>
      {overflowing ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-doc-card px-4 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-900 hover:text-white"
          >
            <span>{expanded ? "收起" : "展开全文"}</span>
            <span aria-hidden className={`text-[10px] transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
