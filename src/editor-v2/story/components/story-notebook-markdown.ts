export type MarkdownEdit = { value: string; selectionStart: number; selectionEnd: number };

export function wrapMarkdown(value: string, start: number, end: number, before: string, after = before): MarkdownEdit {
  const selected = value.slice(start, end);
  return { value: `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`, selectionStart: start + before.length, selectionEnd: end + before.length };
}

export function prefixMarkdownLines(value: string, start: number, end: number, prefix: string): MarkdownEdit {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const followingBreak = value.indexOf("\n", end);
  const lineEnd = followingBreak < 0 ? value.length : followingBreak;
  const block = value.slice(lineStart, lineEnd);
  const prefixed = block.split("\n").map((line) => `${prefix}${line}`).join("\n");
  return { value: `${value.slice(0, lineStart)}${prefixed}${value.slice(lineEnd)}`, selectionStart: start + prefix.length, selectionEnd: end + prefix.length * block.split("\n").length };
}
