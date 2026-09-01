export type WebMcpDiagnostics = { state: "checking" | "unavailable" | "ready" | "error"; registered: number; total: number; errors: string[]; lastSuccessfulTool?: string };
const initial: WebMcpDiagnostics = { state: "checking", registered: 0, total: 0, errors: [] };
let snapshot = initial;
const listeners = new Set<() => void>();
export const getWebMcpDiagnostics = () => snapshot;
export const getServerWebMcpDiagnostics = () => initial;
export function subscribeWebMcpDiagnostics(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function reportWebMcpDiagnostics(next: WebMcpDiagnostics) { snapshot = next; listeners.forEach((listener) => listener()); }
export function recordWebMcpCall(name: string) { reportWebMcpDiagnostics({ ...snapshot, lastSuccessfulTool: name }); }
