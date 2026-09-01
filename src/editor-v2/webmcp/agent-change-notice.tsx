import type { CommandBridge } from "./editor-command-coordinator";
import type { ProposalChangeInput, ProposalChangeReadResult } from "../story/review/proposal-change-types";
import { ProposalChangeDetails } from "./proposal-change-details";
import styles from "./agent-change-notice.module.css";

export type AgentChangeReport = Parameters<NonNullable<CommandBridge["reportAgentChange"]>>[0];
const copy = {
  pl: { title: "Zmiana agenta", undo: "Cofnij", compare: "Pokaż kalkę", close: "Zamknij podsumowanie", details: "Szczegóły zmian", project: "Projekt i widok", places: "Lokalizacje", elements: "Obiekty", surfaces: "Podesty", constructions: "Konstrukcje", roadJunctions: "Skrzyżowania", story: "Opowieść", added: "dodano", removed: "usunięto", changed: "zmieniono" },
  en: { title: "Agent change", undo: "Undo", compare: "Show tracing", close: "Close summary", details: "Change details", project: "Project and view", places: "Places", elements: "Objects", surfaces: "Platforms", constructions: "Construction", roadJunctions: "Junctions", story: "Story", added: "added", removed: "removed", changed: "changed" },
};
export function AgentChangeNotice({ report, locale, canUndo = true, onUndo, onCompare, onClose, currentRevision, currentProjectId, onReadProposalChanges }: { report?: AgentChangeReport; locale: "pl" | "en"; canUndo?: boolean; onUndo(): void; onCompare(id: string): void; onClose(): void; currentRevision?: string; currentProjectId?: string; onReadProposalChanges?(input: ProposalChangeInput): Promise<ProposalChangeReadResult> }) {
  if (!report) return null;
  if (report.proposal && report.semanticChanges?.status === "ready" && currentProjectId && report.semanticChanges.projectId !== currentProjectId) return null;
  const c = copy[locale];
  return <section className={styles.notice} aria-label={c.title} role="status">
    <span>{report.summary}</span>
    <details><summary>{c.details}</summary><ul>{Object.entries(report.changes).filter(([, counts]) => counts.added + counts.removed + counts.changed > 0).map(([key, counts]) => <li key={key}>{c[key as keyof typeof report.changes]}: {counts.added} {c.added}, {counts.removed} {c.removed}, {counts.changed} {c.changed}</li>)}</ul>
      {report.proposal && report.semanticChanges && <ProposalChangeDetails key={report.semanticChanges.status === "ready" ? `${report.checkpointId}:${report.semanticChanges.beforeRevision}:${report.semanticChanges.afterRevision}` : report.checkpointId} initial={report.semanticChanges} locale={locale} currentRevision={currentRevision} currentProjectId={currentProjectId} onRead={onReadProposalChanges}/>}
    </details>
    {!report.proposal && <button type="button" disabled={!canUndo} onClick={onUndo}>{c.undo}</button>}
    {report.checkpointId && <button type="button" onClick={() => onCompare(report.checkpointId!)}>{c.compare}</button>}
    <button type="button" aria-label={c.close} onClick={onClose}>×</button>
  </section>;
}
