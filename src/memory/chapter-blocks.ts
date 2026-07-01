/**
 * 章节可追溯的记忆块工具。
 *
 * 累积型记忆文件（timeline / open_threads / world / characters）里，每一章贡献的内容用
 * HTML 注释分隔符包裹，从而可以按章定位、删除、替换——这样编辑某一章后能重同步它的记忆，
 * 而不会像 append-only 那样越堆越多、无法回收。HTML 注释在 MarkdownView 渲染时被忽略，
 * 不影响记忆页阅读。
 *
 * 块格式：
 *   <!-- wf:chapter <chapterId> start -->
 *   <内容>
 *   <!-- wf:chapter <chapterId> end -->
 */

/** 归属型的固定文件（characters/*.md 另按前缀判定）。 */
export const ATTRIBUTED_MEMORY_FILES = [
  "memory/canon/timeline.md",
  "memory/progress/open_threads.md",
  "memory/canon/world.md",
];

/** 归属型文件：按章打标记、可替换。 */
const ATTRIBUTED_TARGETS = new Set(ATTRIBUTED_MEMORY_FILES);

/** 该 target 是否按章归属（characters/*.md 也算）。 */
export function isAttributedTarget(normalizedTarget: string): boolean {
  if (ATTRIBUTED_TARGETS.has(normalizedTarget)) {
    return true;
  }
  return normalizedTarget.startsWith("memory/canon/characters/") && normalizedTarget.endsWith(".md");
}

const START = (chapterId: string) => `<!-- wf:chapter ${chapterId} start -->`;
const END = (chapterId: string) => `<!-- wf:chapter ${chapterId} end -->`;

/** 把一章的内容包成带标记的块（前后各留一空行，便于阅读与再次分割）。 */
export function wrapChapterBlock(chapterId: string, content: string): string {
  return `\n\n${START(chapterId)}\n${content.trim()}\n${END(chapterId)}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 移除指定章节的所有标记块（含分隔符本身），返回清理后的文本。
 * 用于"改章前先删旧块，再写新块"，保证同一章不会残留多份。
 */
export function stripChapterBlocks(fileText: string, chapterId: string): string {
  const id = escapeRegExp(chapterId);
  // 匹配 start...end 之间的所有内容（含标记与其前的空白），非贪婪。
  const pattern = new RegExp(`\\s*<!-- wf:chapter ${id} start -->[\\s\\S]*?<!-- wf:chapter ${id} end -->\\s*`, "g");
  const cleaned = fileText.replace(pattern, "\n");
  // 收敛多余空行。
  return cleaned.replace(/\n{3,}/g, "\n\n");
}

/**
 * 丢弃从第一个"机器管理标记"起的所有内容，只保留其之前的模板/手写基底。
 * 兼容旧格式 `<!-- Writeflow memory patch: ... -->` 与新格式 `<!-- wf:chapter ... -->`。
 * 供"从章节重建记忆"使用：先清空机器写入部分，再逐章重写。
 */
export function stripAllMachineBlocks(fileText: string): string {
  const markers = [fileText.indexOf("<!-- wf:chapter "), fileText.indexOf("<!-- Writeflow memory patch:")].filter((index) => index >= 0);
  if (markers.length === 0) {
    return fileText.trimEnd() + "\n";
  }
  const cut = Math.min(...markers);
  return fileText.slice(0, cut).trimEnd() + "\n";
}
