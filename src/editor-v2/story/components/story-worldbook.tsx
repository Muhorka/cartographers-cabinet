"use client";

import { useState, type ReactNode } from "react";
import type { StoryCollection, StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import type { StoryViewController } from "./use-story-view";
import { worldbookEntryCopy, worldbookHelp } from "../i18n/worldbook-copy";
import { StoryCreateEntry } from "./story-create-entry";
import { StoryEntryEditor } from "./story-entry-editor";
import { mergeStoryRecordUpdate } from "./story-record-update";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

const collections: StoryCollection[] = ["characters", "factions", "accessGroups", "keys", "propertyDefinitions", "relations", "scenarios", "intentions"];
type CollectionGroup = { label: string; collections: readonly StoryCollection[] };
type Props = { story: StoryDocumentLike; copy: StoryCopy; controller: StoryViewController; resolvedObjects?: StoryResolvedObject[]; excludedCollections?: readonly StoryCollection[]; includedCollections?: readonly StoryCollection[]; heading?: string; renderEntry?(collection: StoryCollection, entry: StoryRecord): ReactNode };

export function StoryWorldbook({ story, copy, controller, resolvedObjects = [], excludedCollections = [], includedCollections, heading, renderEntry }: Props) {
  const { view, collections: items, chooseCollection, selectEntry, updateCollection } = controller;
  const [creating, setCreating] = useState<StoryCollection>();
  const availableCollections = collections.filter((collection) => !excludedCollections.includes(collection) && (!includedCollections || includedCollections.includes(collection)));
  const peopleGroupsLabel = copy.locale === "pl" ? "Grupy" : "Groups";
  const collectionGroups: CollectionGroup[] = [
    { label: copy.peopleGroup, collections: ["characters", "factions", "accessGroups", "keys"] },
    { label: copy.worldGroup, collections: ["scenarios", "intentions", "relations"] },
  ];
  const requestedActive = view.activeCollection === "lenses" ? "characters" : view.activeCollection;
  const active = availableCollections.includes(requestedActive) ? requestedActive : availableCollections[0] ?? "characters";
  const entries = items[active]; const help = worldbookHelp(copy); const labels = worldbookEntryCopy(active, copy);
  const selected = entries.find(({ id }) => id === view.selectedEntryId) ?? entries[0];
  const isCreating = creating === active;
  function updateEntry(next: StoryRecord) { const rendered = entries.find(({ id }) => id === next.id); if (!rendered) return; updateCollection(active, (current) => current.map((entry) => entry.id === next.id ? mergeStoryRecordUpdate(entry, rendered, next) : entry), copy.updateStory, resolvedObjects); }
  function removeEntry() { if (!selected) return; updateCollection(active, (current) => current.filter(({ id }) => id !== selected.id), `${copy.remove} ${selected.name}`, resolvedObjects); selectEntry(undefined); }
  return <section className={styles.bookPanel} aria-label={copy.worldbook}>
    <div className={styles.collectionGroups}>{collectionGroups.map((group) => { const groupCollections = group.collections.filter((collection) => availableCollections.includes(collection)); if (!groupCollections.length) return null; return <section className={styles.collectionGroup} key={group.label} aria-label={group.label}><h3 className={styles.collectionGroupHeading}>{group.label}</h3><div className={styles.collectionRail}>{groupCollections.map((collection) => <button key={collection} type="button" className={active === collection ? styles.isActive : undefined} aria-pressed={active === collection} onClick={() => { setCreating(undefined); chooseCollection(collection); }}>{collection === "accessGroups" ? peopleGroupsLabel : copy[collection]}</button>)}</div></section>; })}</div>
    <header className={styles.panelHeading}><div><span className={styles.kicker}>{heading ?? copy.worldbook}</span><h2>{copy[active]}</h2></div><span className={styles.count}>{entries.length}</span></header>
    <p className={flow.intro}>{labels.hint}</p>
    {active !== "routes" && !isCreating && <div className={flow.toolbar}><button type="button" onClick={() => setCreating(active)}>{labels.add}</button></div>}
    {entries.length > 0 && <p className={flow.hint}>{help.chooseEntry}</p>}
    <div className={styles.entryList} aria-label={help.savedEntries}>
      {entries.map((entry) => <button key={entry.id} type="button" aria-label={`${help.editHint}: ${entry.name}`} aria-pressed={!isCreating && selected?.id === entry.id} className={`${styles.worldbookEntry} ${!isCreating && selected?.id === entry.id ? styles.selectedEntry : ""}`} onClick={() => { setCreating(undefined); selectEntry(entry.id); }}><strong>{entry.name}</strong>{entry.description && <small className={styles.worldbookEntryDescription}>{String(entry.description)}</small>}</button>)}
    </div>
    {!entries.length && !isCreating && <p className={flow.hint}>{help.noEntries}</p>}
    {isCreating ? <StoryCreateEntry key={active} collection={active} story={story} copy={copy} resolvedObjects={resolvedObjects} onCancel={() => setCreating(undefined)} onCreate={(entry) => {
      updateCollection(active, (current) => [...current.filter(({ id }) => id !== entry.id), entry], labels.create, resolvedObjects); selectEntry(entry.id); setCreating(undefined);
    }}/> : selected && active !== "routes" ? <div className={styles.entryEditor}>
      <h3 className={flow.editHeading}>{help.editing}: {selected.name}</h3>
      <p className={flow.saveHint}>{help.autoSave}</p>
      {renderEntry?.(active, selected) ?? <StoryEntryEditor key={`${active}:${selected.id}`} entry={selected} collection={active} story={story} copy={copy} resolvedObjects={resolvedObjects} onChange={updateEntry} onRemove={removeEntry}/>}
    </div> : active === "routes" ? <p className={flow.hint}>{copy.routePanelHint}</p> : null}
  </section>;
}
