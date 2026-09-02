import type { StoryCollection, StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import { defaultStoryAccessPolicy, sameStoryRef, storyRefKey, type StoryObjectMetadata, type StoryObjectRef } from "../types";
import { storyObjectOptions } from "./story-object-options";
import { worldbookEntryCopy, worldbookHelp } from "../i18n/worldbook-copy";
import { zoneCopy } from "../i18n/zone-copy";
import { StoryReferenceChoices } from "./story-reference-choices";
import { StoryWorldbookMemberships, StoryKeyHoldersInfo } from "./story-worldbook-memberships";
import { StoryWorldEntryTraits } from "./story-world-entry-traits";
import { StoryPropertyField } from "./story-property-field";
import { StoryEntryConnections } from "./story-entry-connections";
import { StoryIntentionEditor } from "./story-intention-editor";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

function zoneMemberships(entry: StoryRecord) {
  return Array.isArray(entry.members) ? entry.members.filter((member): member is { ref: StoryObjectRef; relation: "inside" | "overlaps" | "touches" | "near"; partial: boolean; note?: string } => Boolean(member) && typeof member === "object" && typeof (member as { ref?: unknown }).ref === "object" && ["inside", "overlaps", "touches", "near"].includes(String((member as { relation?: unknown }).relation)) && typeof (member as { partial?: unknown }).partial === "boolean").map((member) => ({ ...member, ref: member.ref as StoryObjectRef })) : [];
}

function GroupMetadataEditor({ entry, story, copy, resolvedObjects, onChange }: { entry: StoryRecord; story: StoryDocumentLike; copy: StoryCopy; resolvedObjects: StoryResolvedObject[]; onChange(next: StoryRecord): void }) {
  const source = entry.metadata && typeof entry.metadata === "object" ? entry.metadata as StoryObjectMetadata : {};
  const access = { ...defaultStoryAccessPolicy(), ...(source.access ?? {}) };
  const world = story.world.filter(({ kind }) => kind !== "key").map(({ id, name }) => ({ id, name }));
  const objects = storyObjectOptions(story, resolvedObjects);
  const change = (patch: Partial<StoryObjectMetadata>) => onChange({ ...entry, metadata: { ...source, ...patch } });
  const changeAccess = (patch: Partial<typeof access>) => change({ access: { ...access, ...patch } });
  const multi = (label: string, values: string[], options: Array<{ id: string; name: string }>, update: (value: string[]) => void) => <StoryReferenceChoices label={label} empty={copy.noItems} values={values} options={options} onChange={update}/>;
  return <section className={styles.subsection} aria-label={copy.metadata}><h3>{copy.metadata}</h3>{multi(copy.owner, source.owners ?? [], world, (value) => change({ owners: value }))}{multi(`${copy.access} · ${copy.allow}`, access.allow, world, (value) => changeAccess({ allow: value }))}{multi(`${copy.access} · ${copy.deny}`, access.deny, world, (value) => changeAccess({ deny: value }))}<label className={styles.field}><span>{copy.permission}</span><select value={access.permission} onChange={(event) => changeAccess({ permission: event.currentTarget.value as "open" | "restricted" })}><option value="open">{copy.open}</option><option value="restricted">{copy.restricted}</option></select></label>{story.propertyDefinitions.map((definition) => <StoryPropertyField key={definition.id} definition={definition} value={source.properties?.[definition.id]} objectOptions={objects} worldOptions={story.world} copy={copy} onChange={(value) => change({ properties: { ...(source.properties ?? {}), [definition.id]: value } })}/>)}</section>;
}

function StoryDescriptionAndKnowledge({ entry, story, copy, onChange }: { entry: StoryRecord; story: StoryDocumentLike; copy: StoryCopy; onChange(next: StoryRecord): void }) {
  const help = worldbookHelp(copy);
  const known = Array.isArray(entry.knownEntryIds) ? entry.knownEntryIds.map(String) : [];
  const knowledgeOptions = story.world.filter(({ id }) => id !== entry.id).toSorted((left, right) => left.name.localeCompare(right.name, copy.locale, { sensitivity: "base", numeric: true }));
  return <details className={`${styles.subsection} ${flow.descriptionAndKnowledge}`} open>
    <summary>{copy.descriptionAndKnowledge}</summary>
    <label className={styles.field}><span>{help.optionalDescription}</span><textarea value={String(entry.description ?? "")} placeholder={help.descriptionPlaceholder} onChange={(event) => onChange({ ...entry, description: event.currentTarget.value })} rows={4}/></label>
    <div className={flow.knowledgeBlock}><StoryReferenceChoices label={help.knowledge.replace("{name}", entry.name)} hint={help.knowledgeHint} empty={help.noKnowledge} values={known} options={knowledgeOptions} onChange={(next) => onChange({ ...entry, knownEntryIds: next })}/></div>
  </details>;
}

export function StoryEntryEditor({ entry, collection, story, copy, resolvedObjects, onChange, onRemove }: { entry: StoryRecord; collection: StoryCollection; story: StoryDocumentLike; copy: StoryCopy; resolvedObjects: StoryResolvedObject[]; onChange(next: StoryRecord): void; onRemove(): void }) {
  const update = (field: string, value: unknown) => onChange({ ...entry, [field]: value });
  const narrativeObjectOptions = storyObjectOptions(story, resolvedObjects, "narrative");
  const membershipObjectOptions = storyObjectOptions(story, resolvedObjects, collection === "zones" ? "zone-membership" : collection === "objectGroups" ? "group-membership" : "membership");
  const relationOptions = [...story.world.map((item) => ({ id: `entryId:${item.id}`, name: item.name, source: "characters" as StoryCollection })), ...narrativeObjectOptions];
  const refs = (key: string) => Array.isArray(entry[key]) ? entry[key].map(String) : [];
  const help = worldbookHelp(copy); const labels = worldbookEntryCopy(collection, copy);
  const metadataHint = collection === "zones"
    ? zoneCopy[copy.zones === "Strefy" ? "pl" : "en"].metadataHint
    : help.groupPropertiesHint;
  const members = <StoryReferenceChoices label={help.members.replace("{name}", entry.name)} hint={help.membersHint} empty={help.noObjects} values={refs("memberRefs")} options={membershipObjectOptions} onChange={(value) => update("memberRefs", value)}/>;
  return <div className={styles.form}>
    {collection !== "intentions" && <label className={styles.field}><span>{collection === "relations" ? copy.relationLabel : labels.name}</span><input required={collection !== "relations"} value={entry.name} onChange={(event) => update("name", event.currentTarget.value)}/></label>}
    {(["keys", "objectGroups", "zones", "scenarios"] as StoryCollection[]).includes(collection) && <label className={styles.field}><span>{help.optionalDescription}</span><textarea value={String(entry.description ?? "")} onChange={(event) => update("description", event.currentTarget.value)} rows={3}/></label>}
    {(["characters", "factions", "accessGroups"] as StoryCollection[]).includes(collection) && <><p className={flow.hint}>{help.optional}</p><StoryDescriptionAndKnowledge entry={entry} story={story} copy={copy} onChange={onChange}/><StoryWorldEntryTraits entry={entry} story={story} resolvedObjects={resolvedObjects} copy={copy} onChange={onChange}/><StoryEntryConnections entry={entry} story={story} resolvedObjects={resolvedObjects} copy={copy}/><StoryWorldbookMemberships entry={entry} story={story} copy={copy} omitKnowledge onChange={onChange}/></>}
    {collection === "keys" && <StoryKeyHoldersInfo entry={entry} story={story} copy={copy}/>}

    {collection === "propertyDefinitions" && <><label className={styles.field}><span>{copy.type}</span><select value={String(entry.type ?? "text")} onChange={(event) => update("type", event.currentTarget.value)}><option value="text">{copy.propertyText}</option><option value="number">{copy.propertyNumber}</option><option value="unit">{copy.propertyUnit}</option><option value="boolean">{copy.propertyBoolean}</option><option value="single">{copy.propertySingle}</option><option value="multi">{copy.propertyMulti}</option><option value="entity">{copy.propertyEntity}</option></select></label><label className={styles.field}><span>{copy.group}</span><input value={String(entry.group ?? "")} onChange={(event) => update("group", event.currentTarget.value)}/></label>{entry.type === "unit" && <label className={styles.field}><span>{copy.unit}</span><input value={String(entry.unit ?? "")} onChange={(event) => update("unit", event.currentTarget.value)}/></label>}{(entry.type === "single" || entry.type === "multi") && <label className={styles.field}><span>{copy.options}</span><input value={Array.isArray(entry.options) ? entry.options.join(", ") : String(entry.options ?? "")} onChange={(event) => update("options", event.currentTarget.value.split(",").map((option) => option.trim()).filter(Boolean))}/></label>}</>}
    {collection === "objectGroups" && <>{members}<div className={flow.optionalSections}><details><summary>{help.groupProperties}</summary><p className={flow.hint}>{metadataHint}</p><GroupMetadataEditor entry={entry} story={story} copy={copy} resolvedObjects={resolvedObjects} onChange={onChange}/></details></div></>}
    {collection === "zones" && <>{members}<div className={flow.optionalSections}><details><summary>{help.zoneDetails}</summary>{zoneMemberships(entry).map((member, index) => <div className={styles.stepRow} key={storyRefKey(member.ref)}><span>{membershipObjectOptions.find((item) => sameStoryRef(item.ref, member.ref))?.name ?? storyRefKey(member.ref)}</span><select aria-label={`${copy.relation} ${index + 1}`} value={member.relation} onChange={(event) => update("members", zoneMemberships(entry).map((current) => sameStoryRef(current.ref, member.ref) ? { ...current, relation: event.currentTarget.value } : current))}>{["inside", "overlaps", "touches", "near"].map((relation) => <option key={relation} value={relation}>{copy[relation] ?? relation}</option>)}</select><label className={styles.check}><input type="checkbox" checked={member.partial} onChange={(event) => update("members", zoneMemberships(entry).map((current) => sameStoryRef(current.ref, member.ref) ? { ...current, partial: event.currentTarget.checked } : current))}/><span>{copy.partial}</span></label></div>)}<div className={flow.optionalSections}><details><summary>{copy.metadata}</summary><p className={flow.hint}>{metadataHint}</p><GroupMetadataEditor entry={entry} story={story} copy={copy} resolvedObjects={resolvedObjects} onChange={onChange}/></details></div></details></div></>}
    {collection === "relations" && <><label className={styles.field}><span>{copy.relationKind}</span><select value={String(entry.kind ?? "custom")} onChange={(event) => update("kind", event.currentTarget.value)}>{["owns", "knows", "visits", "guards", "uses", "contains", "custom"].map((kind) => <option key={kind} value={kind}>{copy[kind] ?? kind}</option>)}</select></label><label className={styles.field}><span>{copy.relationSubject}</span><select aria-label={copy.from} value={refs("fromRefs")[0] ?? ""} onChange={(event) => update("fromRefs", event.currentTarget.value)}>{relationOptions.filter(({ id }) => id !== entry.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={styles.field}><span>{copy.relationTarget}</span><select aria-label={copy.to} value={refs("toRefs")[0] ?? ""} onChange={(event) => update("toRefs", event.currentTarget.value)}>{relationOptions.filter(({ id }) => id !== entry.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className={flow.hint}>{(() => { const from = relationOptions.find(({ id }) => id === refs("fromRefs")[0])?.name ?? copy.none; const to = relationOptions.find(({ id }) => id === refs("toRefs")[0])?.name ?? copy.none; return from + " — " + (copy[String(entry.kind ?? "custom")] ?? String(entry.kind ?? "custom")) + " → " + to; })()}</p><label className={styles.field}><span>{copy.relationDescription}</span><textarea rows={3} value={String(entry.description ?? "")} onChange={(event) => update("description", event.currentTarget.value)}/></label><label className={styles.field}><span>{copy.source}</span><input value={String(entry.source ?? "")} onChange={(event) => update("source", event.currentTarget.value)}/></label></>}
    {collection === "intentions" && <StoryIntentionEditor entry={entry} story={story} resolvedObjects={resolvedObjects} copy={copy} onChange={onChange}/>}
    <button type="button" className={styles.dangerButton} onClick={onRemove}>{help.deleteEntry}: {entry.name}</button>
  </div>;
}
