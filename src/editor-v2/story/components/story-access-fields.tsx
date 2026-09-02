import { useState, type ReactNode } from "react";
import type { StoryAccessPolicy } from "../types";
import { inspectorCopy } from "../i18n/inspector-copy";
import type { StoryCollection, StoryCopy, StoryDocumentLike } from "./story-types";
import { StoryReferenceChoices } from "./story-reference-choices";
import styles from "./story-workbench.module.css";
import accessStyles from "./story-access-fields.module.css";

export function StoryAccessFields({ story, copy, value, passage, dirty, keyHoldersEditor, onChange, onOpenWorldbook }: {
  story: StoryDocumentLike; copy: StoryCopy; value: StoryAccessPolicy; passage: boolean; dirty: boolean; keyHoldersEditor?: ReactNode;
  onChange(patch: Partial<StoryAccessPolicy>): void; onOpenWorldbook?(collection: StoryCollection): void;
}) {
  const c = inspectorCopy[copy.locale === "pl" ? "pl" : "en"];
  const [keysOpen, setKeysOpen] = useState(() => value.lock === "locked");
  const people = story.world.filter(({ kind }) => kind !== "key");
  const choices = (field: "allow" | "deny" | "guardIds", label: string) => <StoryReferenceChoices label={label} values={value[field]} options={people} empty={c.noEntries} onChange={(ids) => onChange({ [field]: ids })}/>;
  return <div className={accessStyles.accessFields}>
    <details className={accessStyles.section}><summary>{c.access}</summary><div className={accessStyles.body}>
      <p className={accessStyles.hint}>{c.permissionHint}</p>
      <label className={styles.field}><span>{c.access}</span><select value={value.permission} onChange={(event) => onChange({ permission: event.currentTarget.value as StoryAccessPolicy["permission"] })}><option value="open">{c.public}</option><option value="restricted">{c.restricted}</option><option value="nobody">{c.nobody}</option></select></label>
      {value.permission === "restricted" && choices("allow", c.allowed)}
      {onOpenWorldbook && <div className={accessStyles.actions}><button type="button" onClick={() => onOpenWorldbook("accessGroups")}>{c.groups}</button></div>}
    </div></details>
    {passage && <>
      <details className={accessStyles.section}><summary>{c.passage}</summary><div className={accessStyles.body}>
        <label className={styles.field}><span>{c.passage}</span><select value={value.physicalState} onChange={(event) => onChange({ physicalState: event.currentTarget.value as StoryAccessPolicy["physicalState"] })}><option value="open">{c.doorOpen}</option><option value="closed">{c.doorClosed}</option></select></label>
        <label className={styles.field}><span>{c.lock}</span><select value={value.lock ?? "none"} onChange={(event) => onChange({ lock: event.currentTarget.value as StoryAccessPolicy["lock"] })}><option value="none">{c.noLock}</option><option value="locked">{c.locked}</option><option value="sealed">{c.sealed}</option></select></label>
        <label className={accessStyles.check}><input type="checkbox" checked={Boolean(value.hidden)} onChange={(event) => onChange({ hidden: event.currentTarget.checked })}/><span>{c.hidden}</span></label>
        {value.hidden && <StoryReferenceChoices label={c.knownBy} hint={c.hiddenNobody} values={value.knownBy ?? []} options={people} empty={c.noEntries} onChange={(ids) => onChange({ knownBy: ids })}/>}
      </div></details>
      <details className={accessStyles.section} open={keysOpen} onToggle={(event) => setKeysOpen(event.currentTarget.open)}><summary>{c.keys}: {value.keyIds.length ? c.keyCount(value.keyIds.length) : c.noAssignedKey}</summary><div className={accessStyles.body}>
        <StoryReferenceChoices label={c.keyChoice} hint={c.keyChoiceHint} values={value.keyIds} options={story.world.filter(({ kind }) => kind === "key")} empty={c.noEntries} onChange={(ids) => onChange({ keyIds: ids })}/>
        {keyHoldersEditor && (dirty ? <p className={accessStyles.hint}>{c.saveBeforeKeys}</p> : keyHoldersEditor)}
      </div></details>
    </>}
    {!passage && <details className={accessStyles.section}><summary>{c.hidden}</summary><div className={accessStyles.body}>
      <label className={accessStyles.check}><input type="checkbox" checked={Boolean(value.hidden)} onChange={(event) => onChange({ hidden: event.currentTarget.checked })}/><span>{c.hidden}</span></label>
      {value.hidden && <StoryReferenceChoices label={c.knownBy} hint={c.hiddenNobody} values={value.knownBy ?? []} options={people} empty={c.noEntries} onChange={(ids) => onChange({ knownBy: ids })}/>}
    </div></details>}
    <details className={accessStyles.section}><summary>{c.exceptions}</summary><div className={accessStyles.body}>{choices("deny", c.denied)}{choices("guardIds", c.guard)}</div></details>
  </div>;
}
