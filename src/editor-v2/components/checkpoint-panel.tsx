"use client";
import { useState } from "react";
import type { CheckpointCopy } from "../i18n/checkpoint-copy";
import type { ProjectCheckpointSummary } from "../persistence/project-checkpoint";
import styles from "./checkpoint-panel.module.css";

export function CheckpointPanel({ checkpoints, activeCheckpointId, tracingOpacity, copy, locale, error, onSave, onTracing, onOpacity, onRestore, onRemove }: {
  error?: string;
  checkpoints: ProjectCheckpointSummary[];
  activeCheckpointId?: string;
  tracingOpacity: number;
  copy: CheckpointCopy;
  locale: "pl" | "en";
  onSave(name: string): void;
  onTracing(id?: string): void;
  onOpacity(opacity: number): void;
  onRestore(id: string): void;
  onRemove(id: string): void;
}) {
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState<{ kind: "restore" | "remove"; id: string }>();
  const groups = [
    { key: "manual", label: copy.manual, items: checkpoints.filter((item) => !item.kind || item.kind === "manual") },
    { key: "proposal", label: copy.proposal, items: checkpoints.filter((item) => item.kind === "proposal") },
    { key: "safety", label: copy.agentSafety, items: checkpoints.filter((item) => item.kind === "safety") },
  ];
  return <section className={styles.panel}><details><summary>{copy.title} <small>{checkpoints.length}</small></summary>
    <p className={styles.explanation}>{copy.explanation}</p>
    <form className={styles.create} onSubmit={(event) => { event.preventDefault(); onSave(name.trim()); setName(""); }}><input value={name} placeholder={copy.namePlaceholder} onChange={(event) => setName(event.currentTarget.value)}/><button type="submit">{copy.save}</button></form>
    {error && <p role="alert">{error}</p>}
    {activeCheckpointId && <label className={styles.opacity}><span>{copy.tracingOpacity}</span><input type="range" min="0.1" max="0.9" step="0.05" value={tracingOpacity} onChange={(event) => onOpacity(Number(event.currentTarget.value))}/></label>}
    {!checkpoints.length && <p className={styles.empty}>{copy.empty}</p>}
    {groups.filter(({ items }) => items.length).map((group) => <details key={group.key} open={group.key !== "safety"}><summary>{group.label} ({group.items.length})</summary><ol>{group.items.map((checkpoint) => {
      const pending = confirmation?.id === checkpoint.id ? confirmation.kind : undefined;
      return <li key={checkpoint.id} className={activeCheckpointId === checkpoint.id ? styles.active : undefined}>
        <div><strong>{checkpoint.name}</strong><time dateTime={checkpoint.createdAt}>{new Date(checkpoint.createdAt).toLocaleString(locale === "pl" ? "pl-PL" : "en-GB", { dateStyle: "short", timeStyle: "short" })}</time></div>
        {pending ? <div className={styles.confirm}><p>{pending === "restore" ? copy.confirmRestore : copy.confirmRemove}</p><button type="button" onClick={() => { setConfirmation(undefined); (pending === "restore" ? onRestore : onRemove)(checkpoint.id); }}>{copy.confirm}</button><button type="button" onClick={() => setConfirmation(undefined)}>{copy.cancel}</button></div>
          : <div className={styles.actions}><button type="button" aria-pressed={activeCheckpointId === checkpoint.id} onClick={() => onTracing(activeCheckpointId === checkpoint.id ? undefined : checkpoint.id)}>{activeCheckpointId === checkpoint.id ? copy.hideTracing : copy.showTracing}</button><button type="button" onClick={() => setConfirmation({ kind: "restore", id: checkpoint.id })}>{checkpoint.kind === "proposal" ? locale === "pl" ? "Przyjmij propozycję" : "Adopt proposal" : copy.restore}</button><button type="button" onClick={() => setConfirmation({ kind: "remove", id: checkpoint.id })}>{copy.remove}</button></div>}
      </li>;
    })}</ol></details>)}
  </details></section>;
}
