import { useState } from "react";
import { inspectorCopy } from "../i18n/inspector-copy";
import type { StoryCopy } from "./story-types";
import styles from "./story-worldbook-flow.module.css";

export function StoryQuickAssign({ mode, copy, disabled, onAssign }: {
  mode: "owner" | "trait"; copy: StoryCopy; disabled: boolean;
  onAssign(kind: "character" | "faction" | "boolean-property", name: string): boolean;
}) {
  const [expanded, setExpanded] = useState(false); const [name, setName] = useState("");
  const [kind, setKind] = useState<"character" | "faction">("character");
  const c = inspectorCopy[copy.locale === "pl" ? "pl" : "en"];
  if (!expanded) return <div className={styles.toolbar}><button type="button" disabled={disabled} title={disabled ? c.saveFirst : undefined} onClick={() => setExpanded(true)}>{mode === "owner" ? c.addOwner : c.addTrait}</button></div>;
  return <form className={styles.createForm} onSubmit={(event) => { event.preventDefault(); if (disabled || !name.trim()) return; if (onAssign(mode === "trait" ? "boolean-property" : kind, name.trim())) { setName(""); setExpanded(false); } }}>
    <p className={styles.hint}>{c.quickHint}</p>
    {mode === "owner" && <label>{c.ownerKind}<select value={kind} onChange={(event) => setKind(event.currentTarget.value as typeof kind)}><option value="character">{c.character}</option><option value="faction">{c.faction}</option></select></label>}
    <label>{mode === "owner" ? c.ownerName : c.traitName}<input required value={name} onChange={(event) => setName(event.currentTarget.value)}/></label>
    <div className={styles.createActions}><button disabled={disabled || !name.trim()} type="submit">{c.createAssign}</button><button type="button" onClick={() => setExpanded(false)}>{copy.cancel}</button></div>
  </form>;
}
