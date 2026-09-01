import type { ReactNode } from "react";
import type { StoryAccessPolicy } from "../types";
import { inspectorCopy } from "../i18n/inspector-copy";
import type { StoryCollection, StoryCopy, StoryDocumentLike } from "./story-types";
import { StoryReferenceChoices } from "./story-reference-choices";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

export function StoryAccessFields({ story, copy, value, passage, dirty, keyHoldersEditor, onChange, onOpenWorldbook }: {
  story: StoryDocumentLike; copy: StoryCopy; value: StoryAccessPolicy; passage: boolean; dirty: boolean; keyHoldersEditor?: ReactNode;
  onChange(patch: Partial<StoryAccessPolicy>): void; onOpenWorldbook?(collection: StoryCollection): void;
}) {
  const c = inspectorCopy[copy.locale === "pl" ? "pl" : "en"];
  const people = story.world.filter(({ kind }) => kind !== "key");
  const choices = (field: "allow" | "deny" | "guardIds" | "secretKnowledge", label: string) => <StoryReferenceChoices label={label} values={value[field]} options={people} empty={c.noEntries} onChange={(ids) => onChange({ [field]: ids })}/>;
  return <div className={flow.optionalSections}><details open={passage}><summary>{c.access}</summary>
    <p className={flow.hint}>{c.permissionHint}</p>
    <label className={styles.field}><span>{c.access}</span><select value={value.permission} onChange={(event) => onChange({ permission: event.currentTarget.value as StoryAccessPolicy["permission"] })}><option value="open">{c.public}</option><option value="restricted">{c.restricted}</option></select></label>
    {value.permission === "restricted" && choices("allow", c.allowed)}
    {onOpenWorldbook && <div className={flow.toolbar}><button type="button" onClick={() => onOpenWorldbook("accessGroups")}>{c.groups}</button></div>}
    {passage && <>
      <label className={styles.field}><span>{c.passage}</span><select value={value.physicalState} onChange={(event) => onChange({ physicalState: event.currentTarget.value as StoryAccessPolicy["physicalState"] })}><option value="open">{c.doorOpen}</option><option value="closed">{c.doorClosed}</option></select></label>
      <label className={styles.field}><span>{c.lock}</span><select value={value.lock ?? "none"} onChange={(event) => onChange({ lock: event.currentTarget.value as StoryAccessPolicy["lock"] })}><option value="none">{c.noLock}</option><option value="locked">{c.locked}</option><option value="sealed">{c.sealed}</option></select></label>
      <StoryReferenceChoices label={c.keyChoice} hint={c.keyChoiceHint} values={value.keyIds} options={story.world.filter(({ kind }) => kind === "key")} empty={c.noEntries} onChange={(ids) => onChange({ keyIds: ids })}/>
      {keyHoldersEditor && (dirty ? <p className={flow.hint}>{c.saveBeforeKeys}</p> : keyHoldersEditor)}
    </>}
    <details><summary>{c.exceptions}</summary>{choices("deny", c.denied)}{choices("guardIds", c.guard)}{passage && <>{choices("secretKnowledge", c.secret)}<p className={flow.hint}>{c.secretHint}</p></>}</details>
  </details></div>;
}
