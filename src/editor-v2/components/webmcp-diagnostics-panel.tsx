"use client";
import { useSyncExternalStore } from "react";
import { getServerWebMcpDiagnostics, getWebMcpDiagnostics, subscribeWebMcpDiagnostics } from "../webmcp/diagnostics";
import styles from "./webmcp-diagnostics-panel.module.css";

export function WebMcpDiagnosticsPanel({ locale }: { locale: "pl" | "en" }) {
  const status = useSyncExternalStore(subscribeWebMcpDiagnostics, getWebMcpDiagnostics, getServerWebMcpDiagnostics);
  const pl = locale === "pl";
  const labels = pl ? { checking: "Sprawdzanie…", unavailable: "Brak API przeglądarki", ready: "Narzędzia zarejestrowane", error: "Błąd rejestracji" } : { checking: "Checking…", unavailable: "Browser API unavailable", ready: "Tools registered", error: "Registration error" };
  return <details className={styles.panel}><summary>WebMCP · {labels[status.state]}</summary><div role="status">
    <p>{pl ? "Zarejestrowane narzędzia" : "Registered tools"}: {status.registered}/{status.total || "—"}</p>
    <p>{status.state === "unavailable" ? (pl ? "Ta karta nie udostępnia document.modelContext. Sprawdź obsługę WebMCP w przeglądarce i odśwież stronę." : "This tab does not expose document.modelContext. Check browser WebMCP support and reload.") : status.state !== "ready" ? (pl ? "Rejestracja narzędzi nie została jeszcze potwierdzona." : "Tool registration has not been confirmed yet.") : status.lastSuccessfulTool ? (pl ? "Połączenie z agentem potwierdzone — wykonano narzędzie: " : "Agent connection confirmed — tool executed: ") + status.lastSuccessfulTool : (pl ? "Strona jest gotowa. Nie odnotowano jeszcze udanego wywołania przez agenta w tej sesji. To informacja, nie błąd." : "The page is ready. No successful agent call has been recorded in this session yet. This is informational, not an error.")}</p>
    {status.errors.length > 0 && <ul>{status.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    <button type="button" onClick={() => window.dispatchEvent(new Event("cartographer-webmcp-retry"))}>{pl ? "Sprawdź ponownie" : "Check again"}</button>
  </div></details>;
}
