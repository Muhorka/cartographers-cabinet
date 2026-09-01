import { storyRefKey, type StoryObjectRef } from "./types";

/** Stable collection identity, independent of JSON key order and list position. */
export function storyCollectionEntryId(entry: Record<string, unknown>): string {
  if (typeof entry.id === "string") return entry.id;
  if (entry.ref && typeof entry.ref === "object") return storyRefKey(entry.ref as StoryObjectRef);
  if (typeof entry.subjectId === "string" && typeof entry.groupId === "string" && typeof entry.kind === "string") return JSON.stringify([entry.subjectId, entry.groupId, entry.kind]);
  throw new Error("Story entry has no stable identity.");
}
