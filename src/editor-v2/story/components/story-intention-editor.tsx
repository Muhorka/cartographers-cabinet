"use client";

import { intentionCopy } from "../i18n/intention-copy";
import { storyObjectOptions } from "./story-object-options";
import type { StoryCopy, StoryRecord, StoryResolvedObject } from "./story-types";
import styles from "./story-intention-editor.module.css";
import type { StoryData } from "../types";

type IntentionKind = "reachability" | "must-pass" | "avoid-zone" | "access-rule" | "custom";
type Props = { entry: StoryRecord; story: StoryData; resolvedObjects: StoryResolvedObject[]; copy: StoryCopy; onChange(next: StoryRecord): void };
type Option = { id: string; name: string };

const kinds: IntentionKind[] = ["reachability", "must-pass", "avoid-zone", "access-rule", "custom"];

function value(entry: StoryRecord, key: string) { return typeof entry[key] === "string" ? String(entry[key]) : ""; }
function values(entry: StoryRecord, key: string) { return Array.isArray(entry[key]) ? entry[key].map(String) : []; }

function CurrentReference({ value: selected, options, copy, kind = "object" }: { value: string; options: Option[]; copy: ReturnType<typeof intentionCopy>; kind?: "object" | "actor" }) {
  if (!selected) return null;
  const option = options.find(({ id }) => id === selected);
  if (option) return <p className={styles.current}><strong>{copy.current}:</strong> {option.name}</p>;
  return <div className={styles.missing}><strong>{copy.missing}</strong><span>{selected}</span><span><strong>{copy.whatNeeded}:</strong> {kind === "actor" ? copy.actorNeeded : copy.objectNeeded}</span></div>;
}

function ObjectPicker({ label, selected, options, copy, onChange }: { label: string; selected: string; options: Option[]; copy: ReturnType<typeof intentionCopy>; onChange(value: string): void }) {
  return <label className={styles.field}><span>{label}</span><select value={selected} onChange={(event) => onChange(event.currentTarget.value)}><option value="">{copy.none}</option>{options.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select><CurrentReference value={selected} options={options} copy={copy}/>{!options.length && <p className={styles.hint}>{copy.noObjects}</p>}</label>;
}

function ThroughPicker({ selected, options, copy, onChange }: { selected: string[]; options: Option[]; copy: ReturnType<typeof intentionCopy>; onChange(values: string[]): void }) {
  return <fieldset className={styles.choices}><legend>{copy.through}</legend>{selected.map((id) => <CurrentReference key={id} value={id} options={options} copy={copy}/>)}{options.length ? <div className={styles.choicesList}>{options.map(({ id, name }) => <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={(event) => onChange(event.currentTarget.checked ? [...new Set([...selected, id])] : selected.filter((current) => current !== id))}/><span>{name}</span></label>)}</div> : <p className={styles.hint}>{copy.noObjects}</p>}</fieldset>;
}

export function StoryIntentionEditor({ entry, story, resolvedObjects, copy, onChange }: Props) {
  const text = intentionCopy(copy);
  const kind = kinds.includes(entry.kind as IntentionKind) ? entry.kind as IntentionKind : "custom";
  const objects = storyObjectOptions(story, resolvedObjects);
  const actorOptions = story.world.filter(({ kind: actorKind }) => actorKind === "character" || actorKind === "faction" || actorKind === "access-group").map(({ id, name }) => ({ id, name }));
  const update = (key: string, next: unknown) => onChange({ ...entry, [key]: next });
  const authorStatus = value(entry, "status") || "draft";
  const authorText = typeof entry.text === "string" ? entry.text : value(entry, "description");
  return <section className={styles.editor} aria-label={text.goal}>
    <p className={styles.intro}>{kind === "custom" ? text.customHint : text.validationNote}</p>
    <fieldset className={styles.kind}><legend>{text.goal}</legend><label className={styles.field}><span>{text.kind}</span><select value={kind} onChange={(event) => update("kind", event.currentTarget.value)}>{kinds.map((option) => <option key={option} value={option}>{copy[option] ?? option}</option>)}</select></label></fieldset>
    <ObjectPicker label={text.subject} selected={value(entry, "subjectRef")} options={objects} copy={text} onChange={(next) => update("subjectRef", next)}/>
    {(kind === "reachability" || kind === "must-pass" || kind === "avoid-zone") && <ObjectPicker label={text.destination} selected={value(entry, "targetRef")} options={objects} copy={text} onChange={(next) => update("targetRef", next)}/>}
    {kind === "must-pass" && <ThroughPicker selected={values(entry, "throughRefs")} options={objects} copy={text} onChange={(next) => update("throughRefs", next)}/>}
    {kind === "avoid-zone" && <label className={styles.field}><span>{text.avoidZone}</span><select value={value(entry, "avoidZoneId")} onChange={(event) => update("avoidZoneId", event.currentTarget.value)}><option value="">{text.none}</option>{story.zones.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select>{!story.zones.length && <p className={styles.hint}>{text.noZones}</p>}</label>}
    {kind === "access-rule" && <label className={styles.field}><span>{text.actor}</span><select value={value(entry, "accessEntryId")} onChange={(event) => update("accessEntryId", event.currentTarget.value)}><option value="">{text.none}</option>{actorOptions.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select><CurrentReference value={value(entry, "accessEntryId")} options={actorOptions} copy={text} kind="actor"/>{!actorOptions.length && <p className={styles.hint}>{text.noActors}</p>}</label>}
    <label className={styles.field}><span>{text.text}</span><textarea rows={4} value={authorText} onChange={(event) => update("text", event.currentTarget.value)}/><p className={styles.hint}>{text.textHint}</p></label>
    <label className={styles.field}><span>{text.authorStatus}</span><select value={authorStatus} onChange={(event) => update("status", event.currentTarget.value)}><option value="draft">{text.authorDraft}</option><option value="accepted">{text.authorAccepted}</option><option value="rejected">{text.authorRejected}</option></select><p className={styles.hint}>{text.authorStatusHint}</p></label>
    <p className={styles.validation}>{text.validationNote}</p>
  </section>;
}
