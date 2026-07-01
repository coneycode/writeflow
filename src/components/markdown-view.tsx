import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 渲染 Markdown 为格式化 HTML。样式类 .md-prose 定义在 globals.css，
 * 用 currentColor / 相对色，可在深色（记忆页）与浅色（工作台）底上通用。
 */
export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`md-prose ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
