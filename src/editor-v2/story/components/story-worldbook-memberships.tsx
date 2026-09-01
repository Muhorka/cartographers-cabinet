import { worldbookHelp } from "../i18n/worldbook-copy";
import type { StoryCopy, StoryDocumentLike, StoryRecord } from "./story-types";
import { StoryReferenceChoices } from "./story-reference-choices";
import styles from "./story-worldbook-flow.module.css";

export function StoryWorldbookMemberships({ entry, story, copy, onChange }: { entry: StoryRecord; story: StoryDocumentLike; copy: StoryCopy; onChange(entry: StoryRecord): void }) {
  const help = worldbookHelp(copy);
  const definitions = [
    { field: "membershipGroupIds", label: help.groups, hint: help.groupsHint, empty: help.noGroups, options: story.world.filter(({ id, kind }) => id !== entry.id && (kind === "faction" || kind === "access-group")) },
    { field: "heldKeyIds", label: help.keys, hint: help.keysHint, empty: help.noKeys, options: story.world.filter(({ id, kind }) => id !== entry.id && kind === "key") },
    { field: "knownEntryIds", label: help.knowledge, hint: help.knowledgeHint, empty: help.noKnowledge, options: story.world.filter(({ id }) => id !== entry.id) },
  ];
  return <div className={styles.optionalSections}>{definitions.map(({ field, label, hint, empty, options }) => {
    const values = Array.isArray(entry[field]) ? entry[field].map(String) : [];
    return <details key={field}><summary>{label.replace("{name}", entry.name)} <span>({values.length})</span></summary>
      <StoryReferenceChoices label={copy.value} hint={`${hint} ${help.selectExisting}`} empty={empty} values={values} options={options} onChange={(next) => onChange({ ...entry, [field]: next })}/>
    </details>;
  })}</div>;
}

export function StoryKeyHoldersInfo({ entry, story, copy }: { entry: StoryRecord; story: StoryDocumentLike; copy: StoryCopy }) {
  const help = worldbookHelp(copy);
  const holders = story.memberships.filter(({ kind, groupId }) => kind === "holds-key" && groupId === entry.id).map(({ subjectId }) => story.world.find(({ id }) => id === subjectId)?.name).filter(Boolean);
  return <section className={styles.explanation}><h3>{help.keyHolders}</h3><p>{holders.join(", ") || help.noHolders}</p><p className={styles.hint}>{help.keyHoldersHint}</p></section>;
}
