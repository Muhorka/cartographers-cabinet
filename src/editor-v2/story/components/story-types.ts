import { storyRefKey } from "../types";
import type { StoryData, StoryObjectMetadata, StoryObjectRef } from "../types";

export type StoryLocale = "en" | "pl";
export type StoryTab = "atlas" | "worldbook" | "lenses";
export type StoryCollection = "characters" | "factions" | "accessGroups" | "keys" | "propertyDefinitions" | "objects" | "objectGroups" | "zones" | "relations" | "scenarios" | "intentions" | "routes" | "lenses";
export type StoryRecord = { id: string; name: string; description?: string; [key: string]: unknown };
export type StoryCopy = Record<string, string>;
export type StoryCollections = Record<StoryCollection, StoryRecord[]>;
export type StoryDocumentLike = StoryData;
export type StoryResolvedObject = { ref: StoryObjectRef; name?: string; description?: string; metadata?: StoryObjectMetadata; ownerPlaceId?: string };
export type StorySelection = { id: string; kind?: string; scopeId?: string; ref?: StoryObjectRef; name?: string; metadata?: Record<string, unknown> };
export type StoryTransaction = { id: string; label: string; scope: "story" | "selection" | "view"; changedIds?: string[] };
export type StoryViewState = { tab: StoryTab; activeCollection: StoryCollection; selectedEntryId?: string; selectedGroupId?: string; activeLensId?: string; activeScenarioId?: string; activeStepId?: string; activeRouteId?: string; scenarioContext: "base" | "active" };

function record(value: Record<string, unknown>, fallbackId?: string): StoryRecord { const ref = value.ref && typeof value.ref === "object" ? value.ref as Record<string, unknown> : undefined; const id = String(value.id ?? ref?.id ?? fallbackId ?? ""); return { ...value, id, name: String(value.name ?? ref?.id ?? value.text ?? id ?? "Untitled") } as StoryRecord; }
function records(values: unknown): StoryRecord[] { return Array.isArray(values) ? values.flatMap((value) => value && typeof value === "object" ? [record(value as Record<string, unknown>)] : []) : []; }

export function collectionItems(story: StoryDocumentLike, collection: StoryCollection): StoryRecord[] {
  const source = story as unknown as Record<string, unknown>;
  if (collection === "characters" || collection === "factions" || collection === "accessGroups" || collection === "keys") { const kind = collection === "characters" ? "character" : collection === "factions" ? "faction" : collection === "accessGroups" ? "access-group" : "key"; return story.world.filter((entry) => entry.kind === kind).map((entry) => record({ ...entry, membershipGroupIds: story.memberships.filter((membership) => membership.subjectId === entry.id && membership.kind === "member-of").map(({ groupId }) => groupId), heldKeyIds: story.memberships.filter((membership) => membership.subjectId === entry.id && membership.kind === "holds-key").map(({ groupId }) => groupId), knownEntryIds: story.memberships.filter((membership) => membership.subjectId === entry.id && membership.kind === "knows").map(({ groupId }) => groupId) })); }
  if (collection === "objects") return story.objects.map((entry) => record(entry));
  if (collection === "objectGroups") return story.groups.map((entry) => record({ ...entry, memberIds: entry.memberRefs.map((ref) => ref.id), memberRefs: entry.memberRefs.map(storyRefKey) }));
  if (collection === "propertyDefinitions") return story.propertyDefinitions.map((entry) => record(entry));
  if (collection === "zones") return story.zones.map((entry) => record({ ...entry, memberIds: entry.members.map(({ ref }) => ref.id), memberRefs: entry.members.map(({ ref }) => storyRefKey(ref)) }));
  if (collection === "relations") return story.relations.map((entry) => record({ ...entry, name: entry.label ?? entry.id, fromRefs: [actorKey(entry.from)], toRefs: [actorKey(entry.to)] }));
  if (collection === "scenarios") return story.scenarios.map((entry) => record(entry));
  if (collection === "intentions") return story.intentions.map((entry) => record({ ...entry, name: entry.text.slice(0, 80), description: entry.text, authorId: entry.authorId, subjectRef: storyRefKey(entry.subject), targetRef: entry.target ? storyRefKey(entry.target) : undefined, throughRefs: entry.through?.map(storyRefKey) ?? [] }));
  if (collection === "lenses") return story.lenses.map((entry) => record(entry));
  return records(source[collection]);
}

function actorKey(value: StoryObjectRef | { entryId: string }) { return "entryId" in value ? `entryId:${value.entryId}` : storyRefKey(value); }
