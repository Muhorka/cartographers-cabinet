import { useId, useState } from "react";
import type { StoryCollection, StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import { storyObjectOptions } from "./story-object-options";
import { worldbookEntryCopy, worldbookHelp } from "../i18n/worldbook-copy";
import styles from "./story-worldbook-flow.module.css";

export function StoryCreateEntry({ collection, story, copy, resolvedObjects, onCreate, onCancel }: {
  collection: StoryCollection; story: StoryDocumentLike; copy: StoryCopy; resolvedObjects: StoryResolvedObject[];
  onCreate(entry: StoryRecord): void; onCancel(): void;
}) {
  const [name, setName] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [subject, setSubject] = useState(""); const [kind, setKind] = useState("custom"); const [description, setDescription] = useState(""); const [source, setSource] = useState("");
  const labels = worldbookEntryCopy(collection, copy); const help = worldbookHelp(copy); const hintId = useId();
  const objects = storyObjectOptions(story, resolvedObjects, collection === "relations" || collection === "intentions" ? "narrative" : "all");
  const actors = [...story.world.map(({ id, name }) => ({ id: `entryId:${id}`, name })), ...objects];
  const valid = (collection === "relations" || name.trim()) && (collection !== "relations" || (from && to)) && (collection !== "intentions" || subject);
  const actorName = (id: string) => actors.find((actor) => actor.id === id)?.name ?? copy.none;
  const hint = collection === "relations" ? help.relationHint : collection === "intentions" ? help.intentionHint : help.creationHint;
  return <form className={styles.createForm} aria-label={labels.add} aria-describedby={hintId} onSubmit={(event) => {
    event.preventDefault(); if (!valid) return;
    onCreate({ id: crypto.randomUUID(), name: name.trim() || copy.relation, ...(collection === "propertyDefinitions" ? { type: "boolean" } : {}), ...(collection === "relations" ? { fromRefs: from, toRefs: to, kind, ...(description.trim() ? { description: description.trim() } : {}), ...(source.trim() ? { source: source.trim() } : {}) } : { description: "", ...(collection === "intentions" ? { subjectRef: subject, kind: "custom", text: name.trim(), status: "draft" } : {}) }) });
  }}>
    <h3 className={styles.createHeading}>{labels.add}</h3><p id={hintId} className={styles.hint}>{hint}</p>
    {collection !== "relations" && <label>{labels.name}<input id="story-new-entry" required value={name} onChange={(event) => setName(event.currentTarget.value)}/></label>}
    {collection === "relations" && <><label>{copy.relationKind}<select value={kind} onChange={(event) => setKind(event.currentTarget.value)}>{["owns", "knows", "visits", "guards", "uses", "contains", "custom"].map((value) => <option key={value} value={value}>{copy[value] ?? value}</option>)}</select></label><label>{copy.relationSubject}<select aria-label={copy.from} required value={from} onChange={(event) => setFrom(event.currentTarget.value)}><option value="">{copy.none}</option>{actors.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label><label>{copy.relationTarget}<select aria-label={copy.to} required value={to} onChange={(event) => setTo(event.currentTarget.value)}><option value="">{copy.none}</option>{actors.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label><p className={styles.hint} aria-live="polite">{from && to ? actorName(from) + " — " + (copy[kind] ?? kind) + " → " + actorName(to) : copy.relationPreview}</p><label>{copy.relationLabel}<input id="story-new-entry" value={name} onChange={(event) => setName(event.currentTarget.value)}/></label><label>{copy.relationDescription}<textarea rows={3} value={description} onChange={(event) => setDescription(event.currentTarget.value)}/></label><label>{copy.source}<input value={source} onChange={(event) => setSource(event.currentTarget.value)}/></label></>}
    {collection === "intentions" && <label>{copy.subject}<select aria-label={copy.subject} required value={subject} onChange={(event) => setSubject(event.currentTarget.value)}><option value="">{copy.none}</option>{objects.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>}
    <div className={styles.createActions}><button type="submit" disabled={!valid}>{labels.create}</button><button type="button" onClick={onCancel}>{copy.cancel}</button></div>
  </form>;
}
