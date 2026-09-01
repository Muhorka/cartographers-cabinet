import type { StoryLensExpression, StoryLensPredicate } from "../types";

export type LensMode = "all" | "any" | "not";
export const emptyLensExpression = (): StoryLensExpression => ({ kind: "all", items: [] });

export function changeLensMode(expression: StoryLensExpression, mode: LensMode): StoryLensExpression {
  if (expression.kind === mode) return expression;
  if (mode === "not") return { kind: "not", item: expression };
  const inner = expression.kind === "not" ? expression.item : expression;
  return { kind: mode, items: inner.kind === "all" || inner.kind === "any" ? inner.items : [inner] };
}

export function appendLensPredicate(expression: StoryLensExpression, predicate: StoryLensPredicate): StoryLensExpression {
  const node: StoryLensExpression = { kind: "predicate", predicate };
  if (expression.kind === "not") return { ...expression, item: appendLensPredicate(expression.item, predicate) };
  if (expression.kind === "all" || expression.kind === "any") return { ...expression, items: [...expression.items, node] };
  return { kind: "all", items: [expression, node] };
}

export function removeLensNode(expression: StoryLensExpression, path: readonly number[]): StoryLensExpression {
  if (!path.length) return emptyLensExpression();
  const [index, ...rest] = path;
  if (expression.kind === "not") return rest.length ? { ...expression, item: removeLensNode(expression.item, rest) } : emptyLensExpression();
  if (expression.kind === "predicate") return expression;
  return { ...expression, items: rest.length ? expression.items.map((item, i) => i === index ? removeLensNode(item, rest) : item) : expression.items.filter((_, i) => i !== index) };
}
