"use client";

import { useCallback, useMemo, useState } from "react";
import { collectionItems, type StoryCollection, type StoryDocumentLike, type StoryRecord, type StoryResolvedObject, type StorySelection, type StoryTab, type StoryTransaction, type StoryViewState, type StoryCollections } from "./story-types";
import { sameStoryRef, storyRefKey, type StoryData, type StoryObjectMetadata, type StoryObjectRef } from "../types";
import { patchStoryLensView } from "../lens-view";
import { mergeStoryRecordUpdate } from "./story-record-update";
import { applyStoryCommand } from "../operations";

const initialView: StoryViewState = { tab: "atlas", activeCollection: "characters", scenarioContext: "base" };
export type StoryDocumentUpdate = StoryDocumentLike | ((current: StoryDocumentLike) => StoryDocumentLike);

/**
 * Merge a collection edit produced by an older render into the current
 * collection. Existing IDs are updated field-by-field, explicit deletions from
 * that render are retained, and records created since then are never removed.
 */
function mergeStoryCollectionEdits(current: StoryRecord[], before: StoryRecord[], edited: StoryRecord[]) {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const editedById = new Map(edited.map((item) => [item.id, item]));
  const result = current.flatMap((item) => {
    const rendered = beforeById.get(item.id);
    if (!rendered) return [item];
    const next = editedById.get(item.id);
    return next ? [mergeStoryRecordUpdate(item, rendered, next)] : [];
  });
  const currentIds = new Set(current.map(({ id }) => id));
  return [...result, ...edited.filter(({ id }) => !currentIds.has(id))];
}

export function useStoryView(story: StoryDocumentLike, onStoryChange?: (update: StoryDocumentUpdate, transaction: StoryTransaction) => void, resolvedObjects: StoryResolvedObject[] = [], scopeKey = "default") {
  const [state, setState] = useState({ scopeKey, view: initialView });
  const view = state.scopeKey === scopeKey ? state.view : initialView;
  const [selection, setSelection] = useState<StorySelection | undefined>();

  const updateView = useCallback((patch: Partial<StoryViewState>) => setState((current) => ({ scopeKey, view: patchStoryLensView(current.scopeKey === scopeKey ? current.view : initialView, patch) })), [scopeKey]);
  const chooseTab = useCallback((tab: StoryTab) => updateView({ tab }), [updateView]);
  const chooseCollection = useCallback((activeCollection: StoryCollection) => updateView({ activeCollection, tab: activeCollection === "lenses" ? "lenses" : "worldbook" }), [updateView]);
  const selectEntry = useCallback((selectedEntryId?: string) => updateView({ selectedEntryId }), [updateView]);
  const selectGroup = useCallback((selectedGroupId?: string) => updateView({ selectedGroupId }), [updateView]);

  const commit = useCallback((update: StoryDocumentUpdate, transaction: StoryTransaction) => onStoryChange?.(update, transaction), [onStoryChange]);
  const updateCollection = useCallback((collection: StoryCollection, update: (current: StoryRecord[]) => StoryRecord[], label: string, suppliedResolvedObjects?: StoryResolvedObject[]) => {
    commit((currentStory) => {
      const currentItems = collectionItems(currentStory, collection);
      return replaceStoryCollection(currentStory, collection, update(currentItems), suppliedResolvedObjects ?? resolvedObjects);
    }, { id: `story:${collection}:${Date.now()}`, label, scope: "story" });
  }, [commit, resolvedObjects]);
  const editCollection = useCallback((collection: StoryCollection, nextItems: StoryRecord[], label: string, suppliedResolvedObjects?: StoryResolvedObject[]) => {
    const renderedItems = collectionItems(story, collection);
    updateCollection(collection, (currentItems) => mergeStoryCollectionEdits(currentItems, renderedItems, nextItems), label, suppliedResolvedObjects);
  }, [story, updateCollection]);

  const collections = useMemo<StoryCollections>(() => ({ characters: collectionItems(story, "characters"), factions: collectionItems(story, "factions"), accessGroups: collectionItems(story, "accessGroups"), keys: collectionItems(story, "keys"), propertyDefinitions: collectionItems(story, "propertyDefinitions"), objects: collectionItems(story, "objects"), objectGroups: collectionItems(story, "objectGroups"), zones: collectionItems(story, "zones"), relations: collectionItems(story, "relations"), scenarios: collectionItems(story, "scenarios"), intentions: collectionItems(story, "intentions"), routes: collectionItems(story, "routes"), lenses: collectionItems(story, "lenses") }), [story]);

  return { view, selection, setSelection, chooseTab, chooseCollection, selectEntry, selectGroup, updateView, editCollection, updateCollection, commit, collections };
}

export function replaceStoryCollection(story: StoryData, collection: StoryCollection, items: StoryRecord[], resolvedObjects: StoryResolvedObject[] = []): StoryData {
  const next = { ...story };
  const availableRefs = [...story.objects.map(({ ref }) => ref), ...resolvedObjects.map(({ ref }) => ref)];
  if (["characters", "factions", "accessGroups", "keys"].includes(collection)) {
    const kind = collection === "characters" ? "character" : collection === "factions" ? "faction" : collection === "accessGroups" ? "access-group" : "key";
    const existingKindIds = new Set(story.world.filter((entry) => entry.kind === kind).map(({ id }) => id));
    const nextIds = new Set(items.map(({ id }) => id));
    const deletedIds = [...existingKindIds].filter((id) => !nextIds.has(id));
    if (deletedIds.length) {
      const removal = applyStoryCommand(story, { kind: "bulk", commands: deletedIds.map((id) => ({ kind: "remove", collection: "world", id })) });
      const failure = removal.diagnostics.find(({ code }) => code === "blocked" || code === "invalid" || code === "not-found");
      if (failure) throw new Error(failure.message);
      Object.assign(next, removal.story);
    }
    next.world = [...next.world.filter((entry) => entry.kind !== kind), ...items.map((item) => { const previous = story.world.find((entry) => entry.id === item.id); return { ...(previous ?? { id: item.id, kind, name: item.name, tags: [], properties: {} }), name: item.name, description: typeof item.description === "string" ? item.description : previous?.description, tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : previous?.tags ?? [], properties: item.properties && typeof item.properties === "object" ? item.properties as StoryData["world"][number]["properties"] : previous?.properties ?? {} }; })] as StoryData["world"];
    const deletedIdSet = new Set(deletedIds);
    const authoredMemberships = story.memberships.filter((membership) => !deletedIdSet.has(membership.subjectId) && !deletedIdSet.has(membership.groupId) && !(existingKindIds.has(membership.subjectId)));
    const editedMemberships = items.flatMap((item) => {
      const previous = story.memberships.filter((membership) => membership.subjectId === item.id);
      const ids = (field: string, kindForField: StoryData["memberships"][number]["kind"]) => Array.isArray(item[field]) ? item[field].map(String).filter(Boolean).map((groupId) => previous.find((membership) => membership.kind === kindForField && membership.groupId === groupId) ?? ({ subjectId: item.id, groupId, kind: kindForField, source: "manual" as const })) : previous.filter(({ kind }) => kind === kindForField);
      return [...ids("membershipGroupIds", "member-of"), ...ids("heldKeyIds", "holds-key"), ...ids("knownEntryIds", "knows")];
    });
    next.memberships = [...authoredMemberships, ...editedMemberships];
  } else if (collection === "propertyDefinitions") next.propertyDefinitions = items.map((item) => ({ ...(story.propertyDefinitions.find((entry) => entry.id === item.id) ?? {}), id: item.id, name: item.name, type: (item.type as "text" | "number" | "unit" | "boolean" | "single" | "multi" | "entity" | undefined) ?? "text", ...(typeof item.group === "string" ? { group: item.group } : {}), ...(typeof item.unit === "string" ? { unit: item.unit } : {}), ...(Array.isArray(item.options) ? { options: item.options.map(String) } : {}) }));
  else if (collection === "objectGroups") next.groups = items.map((item) => { const previous = story.groups.find((entry) => entry.id === item.id); const memberRefs = Array.isArray(item.memberRefs) ? encodedRefsToRefs(availableRefs, item.memberRefs, previous?.memberRefs) : Array.isArray(item.memberIds) ? idsToRefs(availableRefs, item.memberIds, previous?.memberRefs) : previous?.memberRefs ?? []; const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata as StoryObjectMetadata : previous?.metadata ?? { tags: [], properties: {} }; return { ...(previous ?? { id: item.id, name: item.name, memberRefs: [], entryIds: [], metadata: { tags: [], properties: {} } }), name: item.name, description: typeof item.description === "string" ? item.description : previous?.description, memberRefs, entryIds: Array.isArray(item.entryIds) ? item.entryIds.map(String) : previous?.entryIds ?? [], metadata }; });
  else if (collection === "zones") next.zones = items.map((item) => { const previous = story.zones.find((entry) => entry.id === item.id); const refs = Array.isArray(item.memberRefs) ? encodedRefsToRefs(availableRefs, item.memberRefs, previous?.members.map(({ ref }) => ref)) : Array.isArray(item.memberIds) ? idsToRefs(availableRefs, item.memberIds, previous?.members.map(({ ref }) => ref)) : previous?.members.map(({ ref }) => ref) ?? []; const previousMembers = previous?.members ?? []; const itemMembers = Array.isArray(item.members) ? item.members.filter((member): member is { ref: StoryObjectRef; relation?: string; partial?: boolean; note?: string } => Boolean(member) && typeof member === "object" && typeof (member as { ref?: unknown }).ref === "object") : []; const members = refs.map((ref) => { const detail = itemMembers.find((member) => sameStoryRef(member.ref, ref)); const retained = previousMembers.find((member) => sameStoryRef(member.ref, ref)); return { ref, relation: (detail?.relation ?? retained?.relation ?? "inside") as "inside" | "overlaps" | "touches" | "near", partial: detail?.partial ?? retained?.partial ?? false, ...(detail?.note !== undefined ? { note: detail.note } : retained?.note !== undefined ? { note: retained.note } : {}) }; }); return { ...(previous ?? { id: item.id, name: item.name, members: [], tags: [] }), name: item.name, description: typeof item.description === "string" ? item.description : previous?.description, members, tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : previous?.tags ?? [], ...(item.metadata && typeof item.metadata === "object" ? { metadata: item.metadata as StoryData["zones"][number]["metadata"] } : previous?.metadata ? { metadata: previous.metadata } : {}), ...(typeof item.color === "string" ? { color: item.color } : previous?.color ? { color: previous.color } : {}) }; });
  else if (collection === "scenarios") {
    const scenarios = items.map((item) => { const previous = story.scenarios.find((entry) => entry.id === item.id); return { ...(previous ?? { id: item.id, name: item.name, patches: [], steps: [] }), name: item.name, description: typeof item.description === "string" ? item.description : previous?.description, patches: Array.isArray(item.patches) ? item.patches as StoryData["scenarios"][number]["patches"] : previous?.patches ?? [], steps: Array.isArray(item.steps) ? item.steps as StoryData["scenarios"][number]["steps"] : previous?.steps ?? [] }; });
    const replacement = applyStoryCommand(story, { kind: "replace", collection: "scenarios", items: scenarios });
    const failure = replacement.diagnostics.find(({ code }) => code === "blocked" || code === "invalid" || code === "not-found");
    if (failure) throw new Error(failure.message);
    next.scenarios = replacement.story.scenarios;
  }
  else if (collection === "relations") next.relations = items.map((item) => { const previous = story.relations.find((entry) => entry.id === item.id); const label = item.name !== previous?.label ? item.name : typeof item.label === "string" ? item.label : previous?.label; const fromKey = Array.isArray(item.fromRefs) ? item.fromRefs[0] : typeof item.fromRefs === "string" ? item.fromRefs : undefined; const toKey = Array.isArray(item.toRefs) ? item.toRefs[0] : typeof item.toRefs === "string" ? item.toRefs : undefined; return { ...(previous ?? { id: item.id, from: { entryId: "" }, to: { entryId: "" }, kind: "custom" as const }), ...(fromKey ? { from: actorForKey(availableRefs, String(fromKey), previous?.from) } : {}), ...(toKey ? { to: actorForKey(availableRefs, String(toKey), previous?.to) } : {}), kind: (item.kind as "owns" | "knows" | "visits" | "guards" | "uses" | "contains" | "custom" | undefined) ?? previous?.kind ?? "custom", ...(label ? { label } : {}), ...(typeof item.description === "string" ? { description: item.description } : {}), ...(typeof item.source === "string" ? { source: item.source } : {}) }; });
  else if (collection === "intentions") next.intentions = items.map((item) => {
    const previous = story.intentions.find((entry) => entry.id === item.id);
    const subject = (typeof item.subjectRef === "string" ? refFromKey(availableRefs, item.subjectRef, previous?.subject) : undefined) ?? previous?.subject ?? { kind: "place" as const, id: "unresolved" };
    const result = { ...(previous ?? { id: item.id, subject, kind: "custom" as const, text: item.name, status: "draft" as const }), subject, kind: (item.kind as "reachability" | "must-pass" | "avoid-zone" | "access-rule" | "custom" | undefined) ?? previous?.kind ?? "custom", text: String(item.text ?? item.description ?? item.name), status: (item.status as "draft" | "accepted" | "rejected" | undefined) ?? previous?.status ?? "draft" };
    if (typeof item.authorId === "string") {
      if (item.authorId) result.authorId = item.authorId;
      else delete result.authorId;
    }
    if (typeof item.targetRef === "string") {
      const target = item.targetRef ? refFromKey(availableRefs, item.targetRef, previous?.target) : undefined;
      if (target) result.target = target;
      else delete result.target;
    }
    if (Array.isArray(item.throughRefs)) result.through = item.throughRefs.map(String).map((key) => refFromKey(availableRefs, key)).filter((ref): ref is StoryObjectRef => Boolean(ref));
    if (typeof item.avoidZoneId === "string") {
      if (item.avoidZoneId) result.avoidZoneId = item.avoidZoneId;
      else delete result.avoidZoneId;
    }
    if (typeof item.accessEntryId === "string") {
      if (item.accessEntryId) result.accessEntryId = item.accessEntryId;
      else delete result.accessEntryId;
    }
    return result;
  });
  else if (collection === "lenses") next.lenses = items.map((item) => { const previous = story.lenses.find((entry) => entry.id === item.id); return { ...(previous ?? { id: item.id, name: item.name, color: "#8a7043", expression: { kind: "all" as const, items: [] } }), name: item.name, color: typeof item.color === "string" ? item.color : previous?.color ?? "#8a7043", favorite: typeof item.favorite === "boolean" ? item.favorite : previous?.favorite, expression: item.expression && typeof item.expression === "object" ? item.expression as StoryData["lenses"][number]["expression"] : previous?.expression ?? { kind: "all", items: [] } }; });
  else if (collection === "routes") next.routes = items.flatMap((item) => { const previous = story.routes.find(({ id }) => id === item.id); return previous ? [{ ...previous, name: item.name }] : []; });
  return next;
}

function idsToRefs(availableRefs: StoryData["objects"][number]["ref"][], ids: unknown, previous: StoryData["objects"][number]["ref"][] = []): StoryData["objects"][number]["ref"][] { return Array.isArray(ids) ? ids.map(String).flatMap((id) => { const candidates = availableRefs.filter((ref) => ref.id === id); return candidates.length === 1 ? [candidates[0]!] : previous.filter((ref) => ref.id === id); }) : previous; }
function encodedRefsToRefs(availableRefs: StoryData["objects"][number]["ref"][], values: unknown, previous: StoryData["objects"][number]["ref"][] = []): StoryData["objects"][number]["ref"][] { return Array.isArray(values) ? values.map(String).flatMap((key) => { const ref = availableRefs.find((candidate) => storyRefKey(candidate) === key); if (ref) return [ref]; const retained = previous.find((candidate) => storyRefKey(candidate) === key); return retained ? [retained] : []; }) : previous; }
function actorForKey(availableRefs: StoryObjectRef[], key: string, previous?: StoryData["relations"][number]["from"]) { if (key.startsWith("entryId:")) return { entryId: key.slice("entryId:".length) }; const ref = availableRefs.find((candidate) => storyRefKey(candidate) === key); return ref ?? previous ?? { entryId: key }; }
function refFromKey(availableRefs: StoryObjectRef[], key: string, previous?: StoryObjectRef) { return availableRefs.find((candidate) => storyRefKey(candidate) === key) ?? previous; }

export type StoryViewController = ReturnType<typeof useStoryView>;
