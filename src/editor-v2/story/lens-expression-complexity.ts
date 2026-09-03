/** Limits for the recursive lens-expression grammar at untrusted boundaries. */
const LENS_EXPRESSION_MAX_DEPTH = 32;
const LENS_EXPRESSION_MAX_NODES = 10_000;

/**
 * Checks expression shape iteratively before the recursive Zod schema sees it.
 * Non-expression values are left for Zod's normal type errors; this guard only
 * rejects inputs that could make recursive validation unsafe.
 */
export function isLensExpressionWithinComplexity(input: unknown) {
  if (!input || typeof input !== "object") return true;
  const pending: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 1 }];
  const visited = new WeakSet<object>();
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (!current.value || typeof current.value !== "object") continue;
    if (current.depth > LENS_EXPRESSION_MAX_DEPTH) return false;
    if (visited.has(current.value)) return false;
    visited.add(current.value);
    nodes += 1;
    if (nodes > LENS_EXPRESSION_MAX_NODES) return false;

    const expression = current.value as { kind?: unknown; item?: unknown; items?: unknown };
    if (expression.kind === "not") {
      pending.push({ value: expression.item, depth: current.depth + 1 });
    } else if (expression.kind === "all" || expression.kind === "any") {
      if (Array.isArray(expression.items)) {
        for (const item of expression.items) pending.push({ value: item, depth: current.depth + 1 });
      }
    }
  }
  return true;
}
