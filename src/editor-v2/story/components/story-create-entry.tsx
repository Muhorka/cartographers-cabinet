import { useId, useState } from "react";
import type { StoryCollection, StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import { storyObjectOptions } from "./story-object-options";
import { worldbookEntryCopy, worldbookHelp } from "../i18n/worldbook-copy";
import styles from "./story-worldbook-flow.module.css";

export function StoryCreateEntry({ collection, story, copy, resolvedObjects, onCreate, onCancel }: {
  collection: StoryCollection; story: StoryDocumentLike; copy: StoryCopy; resolvedObjects: StoryResolvedObject[];
  onCreate(entry: StoryRecord): void; onCancel(): void;
}) {
  const [name, setName] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [subject, setSubject] = useState("");
  const labels = worldbookEntryCopy(collection, copy); const help = worldbookHelp(copy); const hintId = useId();
  const objects = storyObjectOptions(story, resolvedObjects);
  const actors = [...story.world.map(({ id, name }) => ({ id: `entryId:${id}`, name })), ...objects];
  const valid = name.trim() && (collection !== "relations" || (from && to)) && (collection !== "intentions" || subject);
  const hint = collection === "relations" ? help.relationHint : collection === "intentions" ? help.intentionHint : help.creationHint;
  return <form className={styles.createForm} aria-label={labels.add} aria-describedby={hintId} onSubmit={(event) => {
    event.preventDefault(); if (!valid) return;
    onCreate({ id: crypto.randomUUID(), name: name.trim(), description: "", ...(collection === "propertyDefinitions" ? { type: "boolean" } : {}), ...(collection === "relations" ? { fromRefs: from, toRefs: to, kind: "custom" } : {}), ...(collection === "intentions" ? { subjectRef: subject, kind: "custom", text: name.trim(), status: "draft" } : {}) });
  }}>
    <h3 className={styles.createHeading}>{labels.add}</h3><p id={hintId} className={styles.hint}>{hint}</p>
    <label>{labels.name}<input id="story-new-entry" required value={name} onChange={(event) => setName(event.currentTarget.value)}/></label>
    {collection === "relations" && <>{([{ label: copy.from, value: from, change: setFrom }, { label: copy.to, value: to, change: setTo }]).map(({ label, value, change }) => <label key={label}>{label}<select aria-label={label} required value={value} onChange={(event) => change(event.currentTarget.value)}><option value="">{copy.none}</option>{actors.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>)}</>}
    {collection === "intentions" && <label>{copy.subject}<select aria-label={copy.subject} required value={subject} onChange={(event) => setSubject(event.currentTarget.value)}><option value="">{copy.none}</option>{objects.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>}
    <div className={styles.createActions}><button type="submit" disabled={!valid}>{labels.create}</button><button type="button" onClick={onCancel}>{copy.cancel}</button></div>
  </form>;
}
