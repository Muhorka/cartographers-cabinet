export type WebMcpDiagnostics = { state: "checking" | "unavailable" | "ready" | "error"; registered: number; total: number; errors: string[]; lastSuccessfulTool?: string };
const initial: WebMcpDiagnostics = { state: "checking", registered: 0, total: 0, errors: [] };
let snapshot = initial;
const listeners = new Set<() => void>();
export const getWebMcpDiagnostics = () => snapshot;
export const getServerWebMcpDiagnostics = () => initial;
export function subscribeWebMcpDiagnostics(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function reportWebMcpDiagnostics(next: WebMcpDiagnostics) { snapshot = next; listeners.forEach((listener) => listener()); }
/** Statuses that mean the registered tool completed its requested operation. */
const successfulStatuses = new Set([
  "applied", "accepted", "proposed", "prepared", "created", "duplicated", "renamed", "deleted", "shown", "hidden", "compared",
  "saved", "view-updated", "deferred", "no-change", "ready", "complete", "satisfied", "conditional", "unknown", "needs-author-review",
  "unreachable", "partial", "resolved", "discarded", "changed", "opened", "undone", "redone", "focused", "cleared",
]);
export function isSuccessfulWebMcpResult(result: unknown) {
  if (!result || typeof result !== "object" || !("structuredContent" in result)) return false;
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  if (!structured || typeof structured !== "object" || Array.isArray(structured)) return false;
  if (!("status" in structured)) return true;
  const status = (structured as { status?: unknown }).status;
  return typeof status === "string" && successfulStatuses.has(status);
}
export function recordWebMcpCall(name: string) { reportWebMcpDiagnostics({ ...snapshot, lastSuccessfulTool: name }); }
