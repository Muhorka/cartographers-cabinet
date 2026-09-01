"use client";

import { useState, type ReactNode } from "react";
import type { StoryCollection, StoryCopy, StoryDocumentLike, StoryRecord, StoryResolvedObject } from "./story-types";
import type { StoryViewController } from "./use-story-view";
import { worldbookEntryCopy, worldbookHelp } from "../i18n/worldbook-copy";
import { StoryCreateEntry } from "./story-create-entry";
import { StoryEntryEditor } from "./story-entry-editor";
import flow from "./story-worldbook-flow.module.css";
import styles from "./story-workbench.module.css";

const collections: StoryCollection[] = ["characters", "factions", "accessGroups", "keys", "propertyDefinitions", "objectGroups", "zones", "relations", "scenarios", "intentions", "routes"];
type Props = { story: StoryDocumentLike; copy: StoryCopy; controller: StoryViewController; resolvedObjects?: StoryResolvedObject[]; excludedCollections?: readonly StoryCollection[]; renderEntry?(collection: StoryCollection, entry: StoryRecord): ReactNode };

export function StoryWorldbook({ story, copy, controller, resolvedObjects = [], excludedCollections = [], renderEntry }: Props) {
  const { view, collections: items, chooseCollection, selectEntry, editCollection } = controller;
  const [creating, setCreating] = useState<StoryCollection>();
  const availableCollections = collections.filter((collection) => !excludedCollections.includes(collection));
  const requestedActive = view.activeCollection === "lenses" ? "characters" : view.activeCollection;
  const active = availableCollections.includes(requestedActive) ? requestedActive : availableCollections[0] ?? "characters";
  const entries = items[active]; const help = worldbookHelp(copy); const labels = worldbookEntryCopy(active, copy);
  const selected = entries.find(({ id }) => id === view.selectedEntryId) ?? entries[0];
  const isCreating = creating === active;
  function updateEntry(next: StoryRecord) { editCollection(active, entries.map((entry) => entry.id === next.id ? next : entry), copy.updateStory, resolvedObjects); }
  function removeEntry() { if (!selected) return; editCollection(active, entries.filter(({ id }) => id !== selected.id), `${copy.remove} ${selected.name}`, resolvedObjects); selectEntry(undefined); }
  return <section className={styles.bookPanel} aria-label={copy.worldbook}>
    <div className={styles.collectionRail}>{availableCollections.map((collection) => <button key={collection} type="button" className={active === collection ? styles.isActive : undefined} aria-pressed={active === collection} onClick={() => { setCreating(undefined); chooseCollection(collection); }}>{copy[collection]}</button>)}</div>
    <header className={styles.panelHeading}><div><span className={styles.kicker}>{copy.worldbook}</span><h2>{copy[active]}</h2></div><span className={styles.count}>{entries.length}</span></header>
    <p className={flow.intro}>{labels.hint}</p>
    {active !== "routes" && !isCreating && <div className={flow.toolbar}><button type="button" onClick={() => setCreating(active)}>{labels.add}</button></div>}
    {entries.length > 0 && <p className={flow.hint}>{help.chooseEntry}</p>}
    <div className={styles.entryList} aria-label={help.savedEntries}>
      {entries.map((entry) => <button key={entry.id} type="button" aria-label={`${help.editHint}: ${entry.name}`} aria-pressed={!isCreating && selected?.id === entry.id} className={!isCreating && selected?.id === entry.id ? styles.selectedEntry : undefined} onClick={() => { setCreating(undefined); selectEntry(entry.id); }}><strong>{entry.name}</strong>{entry.description && <small>{String(entry.description)}</small>}</button>)}
    </div>
    {!entries.length && !isCreating && <p className={flow.hint}>{help.noEntries}</p>}
    {isCreating ? <StoryCreateEntry key={active} collection={active} story={story} copy={copy} resolvedObjects={resolvedObjects} onCancel={() => setCreating(undefined)} onCreate={(entry) => {
      editCollection(active, [...entries, entry], labels.create, resolvedObjects); selectEntry(entry.id); setCreating(undefined);
    }}/> : selected && active !== "routes" ? <div className={styles.entryEditor}>
      <h3 className={flow.editHeading}>{help.editing}: {selected.name}</h3>
      <p className={flow.saveHint}>{help.autoSave}</p>
      {renderEntry?.(active, selected) ?? <StoryEntryEditor key={`${active}:${selected.id}`} entry={selected} collection={active} story={story} copy={copy} resolvedObjects={resolvedObjects} onChange={updateEntry} onRemove={removeEntry}/>}
    </div> : active === "routes" ? <p className={flow.hint}>{copy.routePanelHint}</p> : null}
  </section>;
}
