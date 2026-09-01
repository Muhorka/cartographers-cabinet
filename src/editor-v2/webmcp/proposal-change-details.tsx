"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { ProposalChangeInput, ProposalChangeReadResult, ProposalFieldRow } from "../story/review/proposal-change-types";
import { proposalCopy } from "../story/i18n/proposal-copy";
import { formatProposalCoverageReason } from "../story/review/coverage-format";
import styles from "./agent-change-notice.module.css";

function FieldRow({ row, locale }: { row: ProposalFieldRow; locale: "pl" | "en" }) {
  const c = proposalCopy[locale]; const d = row.display[locale];
  const scenario = row.names.scenarioAfter ?? row.names.scenarioBefore ?? row.context.scenarioId;
  const step = row.names.stepAfter ?? row.names.stepBefore ?? row.context.stepId;
  const scope = row.names.scopeAfter ?? row.names.scopeBefore ?? row.ref.scopeId;
  const name = d.objectBefore === d.objectAfter ? d.objectAfter : `${d.objectBefore} → ${d.objectAfter}`;
  return <li className={styles.semanticRow} data-change-field={row.fieldKey}>
    <strong>{name}{scope && <> · {scope}</>}</strong><small>{scenario ?? c.base}{step && <> / {step}</>}</small>
    <div><strong>{d.field}</strong></div>
    <dl><div><dt>{c.authored}</dt><dd>{c.before}: {d.authoredBefore} → {c.after}: {d.authoredAfter}</dd></div><div><dt>{c.effective}</dt><dd>{c.before}: {d.effectiveBefore} → {c.after}: {d.effectiveAfter}</dd></div></dl>
    {Object.values(row.missing).some(Boolean) && <p>{c.missing}</p>}
    {row.effectiveChanged === false && <p>{c.unchanged}</p>}
    <details><summary>{c.provenance}</summary>
      <p>{c.source}: {row.source.collection} / {row.source.scenarioId ?? c.base}{row.source.stepId && ` / ${row.source.stepId}`}{row.source.patchId && ` / ${row.source.patchId}`} / {row.authoredPath}</p>
      <code>{JSON.stringify(row.ref)}</code>
      {(["before", "after"] as const).map((side) => <div key={side}><strong>{c[side]}</strong>{!row.evidence[side].provenanceAvailable && <p>{c.noProvenance}</p>}{row.evidence[side].sources.length > 0 && <p>{c.sources}: {row.evidence[side].sources.join(", ")}</p>}{row.evidence[side].conflicts.length > 0 && <p>{c.conflicts}: {row.evidence[side].conflicts.join(", ")}</p>}</div>)}
    </details>
  </li>;
}

export function ProposalChangeDetails({ initial, locale, currentRevision, currentProjectId, onRead }: {
  initial: ProposalChangeReadResult; locale: "pl" | "en"; currentRevision?: string; currentProjectId?: string;
  onRead?(input: ProposalChangeInput): Promise<ProposalChangeReadResult>;
}) {
  const [page, setPage] = useState(initial); const [loading, setLoading] = useState(false); const [error, setError] = useState(false);
  const request = useRef(0); const c = proposalCopy[locale];
  useLayoutEffect(() => () => { request.current += 1; setLoading(false); }, [currentRevision, currentProjectId, initial]);
  if (page.status !== "ready") return <p role="status">{c.unavailable} ({page.reason})</p>;
  if (currentProjectId && page.projectId !== currentProjectId) return null;
  const stale = page.applicability === "stale" || Boolean(currentRevision && currentRevision !== page.beforeRevision);
  async function load(cursor?: string) {
    if (!onRead || page.status !== "ready") return;
    const attempt = ++request.current; setLoading(true); setError(false);
    try {
      const result = await onRead({ checkpointId: page.checkpointId, ...page.query, cursor, limit: page.limit });
      if (request.current !== attempt) return;
      if (result.status === "ready" && result.checkpointId === page.checkpointId && result.beforeRevision === page.beforeRevision && result.afterRevision === page.afterRevision) setPage(result);
      else setError(true);
    } catch { if (request.current === attempt) setError(true); }
    finally { if (request.current === attempt) setLoading(false); }
  }
  return <section className={styles.semanticDetails} aria-label={c.title}>
    <h3>{c.title}</h3><p>{c.scope}</p>{stale && <p role="status">{c.stale}</p>}
    {page.coverage.unsupportedChanges.length > 0 && <div>
      <p>{c.unsupported}</p><ul>{page.coverage.unsupportedChanges.map((code, index) => <li key={`${code}:${index}`}>{code === "ambiguous-story-records" ? <strong>{formatProposalCoverageReason(code, locale)}</strong> : formatProposalCoverageReason(code, locale)}</li>)}</ul>
      <details><summary>{c.coverageCodes}</summary><ul>{page.coverage.unsupportedChanges.map((code, index) => <li key={`${code}:${index}`}><code>{code}</code></li>)}</ul></details>
    </div>}
    <p>{c.shown}: {page.rows.length ? page.offset + 1 : 0}–{page.offset + page.rows.length} {c.of} {page.total}</p>
    {!page.rows.length ? <p>{c.empty}</p> : <ul>{page.rows.map((row) => <FieldRow key={row.id} row={row} locale={locale}/>)}</ul>}
    {error && <p role="alert">{c.unavailable}</p>}
    {page.offset > 0 && <button type="button" disabled={loading || !onRead} onClick={() => void load()}>{c.first}</button>}
    {page.nextCursor && <button type="button" disabled={loading || !onRead} onClick={() => void load(page.nextCursor)}>{loading ? c.loading : c.more}</button>}
    {page.nextCursor && !onRead && <p>{c.loaderMissing}</p>}
  </section>;
}
