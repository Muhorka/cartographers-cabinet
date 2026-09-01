"use client";

import { useState } from "react";
import type { EditorProject } from "../model/project-model";
import type { ProjectTransaction } from "../state/editor-session";
import { collectionItems, type StoryRecord, type StoryResolvedObject } from "../story/components/story-types";
import { replaceStoryCollection } from "../story/components/use-story-view";
import { StoryEntryEditor } from "../story/components/story-entry-editor";
import { StoryZoneList } from "../story/components/story-zone-list";
import { StoryZoneMemberships } from "../story/components/story-zone-memberships";
import { storyCopy } from "../story/i18n/story-copy";
import { zoneCopy } from "../story/i18n/zone-copy";
import { createProjectZone, zoneMemberRefs } from "../story/zone-operations";
import { storyDataSchema } from "../story/schema";
import type { StoryObjectRef } from "../story/types";
import styles from "../story/components/story-zone-list.module.css";

/** Zones share one session/history in both work modes; selection is only UI state. */
export function useWorkbenchZones({ project, activePlaceId, selectionRefs, inspectedRefs, resolvedObjects, locale, commit, onError }: {
  project?: EditorProject; activePlaceId?: string; selectionRefs: StoryObjectRef[]; inspectedRefs: StoryObjectRef[];
  resolvedObjects: StoryResolvedObject[]; locale: "pl" | "en";
  commit(transaction: ProjectTransaction): boolean; onError(message: string): void;
}) {
  const c = zoneCopy[locale]; const copy = storyCopy[locale];
  const [focus, setFocus] = useState<{ projectId: string; placeId?: string; id: string; refs: string }>();
  const selectionKey = JSON.stringify(selectionRefs);
  const selectedId = focus?.projectId === project?.id && focus?.placeId === activePlaceId && focus?.refs === selectionKey ? focus?.id : undefined;
  const selected = project?.story.zones.find(({ id }) => id === selectedId);
  const eligible = project ? zoneMemberRefs(project, selectionRefs) : [];
  const select = (id: string) => project && setFocus({ projectId: project.id, placeId: activePlaceId, refs: selectionKey, id });
  function apply(change: ProjectTransaction["apply"]) {
    try { return commit({ id: `story-zone:${crypto.randomUUID()}`, apply: change }); }
    catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); return false; }
  }
  function create(name: string) {
    const id = crypto.randomUUID();
    const result = apply((current) => createProjectZone(current, { id, name, refs: eligible, color: "#9a6a9d" }));
    if (result) select(id);
    return result;
  }
  function edit(entry: StoryRecord) {
    return apply((current) => {
      const entries = collectionItems(current.story, "zones").map((existing) => existing.id === entry.id ? entry : existing);
      return { ...current, story: storyDataSchema.parse(replaceStoryCollection(current.story, "zones", entries, resolvedObjects)) };
    });
  }
  const selectedEntry = project && selected ? collectionItems(project.story, "zones").find(({ id }) => id === selected.id) : undefined;
  return {
    selectedId: selected?.id, clear: () => setFocus(undefined),
    list: project ? <StoryZoneList zones={project.story.zones} selectedId={selected?.id} selectionCount={eligible.length} omittedCount={selectionRefs.length - eligible.length} locale={locale} onSelect={select} onCreate={create}/> : undefined,
    membership: project ? <StoryZoneMemberships project={project} refs={inspectedRefs} locale={locale} onSelect={select}/> : undefined,
    inspector: project && selected && selectedEntry ? <section className={styles.list} aria-label={`${c.title}: ${selected.name}`}>
      <button type="button" onClick={() => setFocus(undefined)}>{c.close}</button><h2>{selected.name}</h2><p>{c.description}</p><p>{c.saved}</p>
      <label>{c.color}<input aria-label={c.color} type="color" value={selected.color ?? "#9a6a9d"} onChange={(event) => edit({ ...selectedEntry, color: event.currentTarget.value })}/></label>
      <p>{c.metadataHint}</p>
      <StoryEntryEditor entry={selectedEntry} collection="zones" story={project.story} resolvedObjects={resolvedObjects} copy={copy} onChange={edit} onRemove={() => {
        if (apply((current) => ({ ...current, story: { ...current.story, zones: current.story.zones.filter(({ id }) => id !== selected.id) } }))) setFocus(undefined);
      }}/>
    </section> : undefined,
  };
}
