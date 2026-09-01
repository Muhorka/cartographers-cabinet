import type { EditorProject } from "../model/project-model";
import { effectiveProjectStoryObject, projectStoryData } from "./project-effective";
import { applyProjectStoryMetadata } from "./project-commands";
import { resolveStoryObject } from "./project-adapter";
import { defaultStoryAccessPolicy, storyRefKey, type StoryObjectRef, type StoryViewContext } from "./types";

export type AssignProjectKeyHoldersInput = {
  /** The scoped construction opening to which the key is attached. */
  ref: StoryObjectRef & { kind: "opening" };
  /** Required when the opening already has more than one key. */
  keyId?: string;
  /** Existing character, faction or access-group ids. Keys cannot hold other keys. */
  holderIds: readonly string[];
  /** Optional localized name supplied by the UI when a key must be created. */
  keyName?: string;
  /** Where the opening access annotation is written; holder inventory stays a base-world fact. */
  target?: "base" | "scenario";
  context?: StoryViewContext;
};

const holderKinds = new Set(["character", "faction", "access-group"]);

function reject(message: string): never {
  throw new Error(`Key holder assignment rejected: ${message}`);
}

function uniqueIds(values: readonly string[]) {
  return [...new Set(values)];
}

function newKeyId(world: EditorProject["story"]["world"], opening: string) {
  const stem = `key-passage-${opening.replace(/[^a-zA-Z0-9_-]+/g, "-") || "opening"}`;
  const used = new Set(world.map(({ id }) => id));
  if (!used.has(stem)) return stem;
  let suffix = 2;
  while (used.has(`${stem}-${suffix}`)) suffix++;
  return `${stem}-${suffix}`;
}

function uniqueKeyName(world: EditorProject["story"]["world"], requested: string | undefined) {
  const base = requested?.trim() || "Passage key";
  const names = new Set(world.filter(({ kind }) => kind === "key").map(({ name }) => name.trim().toLocaleLowerCase()));
  if (!names.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix++;
  return `${base} ${suffix}`;
}

/**
 * Atomically assigns the holders of one key on one opening.
 *
 * The operation intentionally requires `keyId` when the opening has multiple
 * keys. With no selected key and no holders it is a no-op, so an empty UI form
 * never creates an orphan key. Existing holds-key records for other keys and
 * all other membership kinds are left untouched.
 */
export function assignProjectKeyHolders(project: EditorProject, input: AssignProjectKeyHoldersInput): EditorProject {
  if (input.ref.kind !== "opening" || !input.ref.scopeId || !input.ref.id) reject("an opening with a construction scope is required");
  const story = projectStoryData(project);
  const resolvedOpening = resolveStoryObject(project, story, input.ref);
  if (!resolvedOpening || resolvedOpening.ref.kind !== "opening") reject(`opening ${storyRefKey(input.ref)} does not exist`);
  if (resolvedOpening.editor.locked) reject(`opening ${storyRefKey(input.ref)} is editor-locked`);

  const target = input.target ?? (input.context?.scenarioId ? "scenario" : "base");
  if (target === "scenario" && !input.context?.scenarioId) reject("scenario target requires a scenario context");

  const holderIds = uniqueIds(input.holderIds);
  const world = story.world;
  holderIds.forEach((id) => {
    const entry = world.find((candidate) => candidate.id === id);
    if (!entry) reject(`holder ${id} does not exist`);
    if (!holderKinds.has(entry.kind)) reject(`holder ${id} must be a character, faction or access group`);
  });

  // Read keys from the same view that is being edited. A scenario may add or
  // replace the opening's keys even when its base record has none.
  const effective = effectiveProjectStoryObject(project, resolvedOpening.ref, target === "scenario" ? input.context : {});
  const currentAccess = { ...defaultStoryAccessPolicy(), ...(effective?.metadata.access ?? {}) };
  // An explicit scenario key list is authoritative for that scenario. An
  // empty list therefore means no scenario keys; inheritance is resolved by
  // effectiveProjectStoryObject when the scenario has no overriding patch.
  const currentKeyIds = uniqueIds(currentAccess.keyIds);
  let selectedKeyId = input.keyId;
  let createdKey: EditorProject["story"]["world"][number] | undefined;
  if (selectedKeyId === undefined) {
    if (!holderIds.length) return project;
    if (currentKeyIds.length > 1) reject("keyId is required when the opening has multiple keys");
    selectedKeyId = currentKeyIds[0];
    if (!selectedKeyId) {
      selectedKeyId = newKeyId(world, resolvedOpening.ref.id);
      createdKey = { id: selectedKeyId, kind: "key", name: uniqueKeyName(world, input.keyName), tags: [], properties: {} };
    }
  }

  const selectedWorldKey = world.find((entry) => entry.id === selectedKeyId);
  if (!createdKey && (!selectedWorldKey || selectedWorldKey.kind !== "key")) reject(`key ${selectedKeyId} does not exist`);

  // Supplying the full effective access policy keeps access state/lock/guards
  // intact while accessFields scopes the command to keyIds only.
  const metadataProject = applyProjectStoryMetadata(project, {
    refs: [resolvedOpening.ref],
    target,
    context: input.context,
    action: "replace",
    metadata: { access: { ...currentAccess, keyIds: uniqueIds([...currentKeyIds, selectedKeyId]) } },
    accessFields: ["keyIds"],
  });
  const nextStory = metadataProject.story;
  const nextWorld = createdKey ? [...nextStory.world, createdKey] : nextStory.world;
  const nextMemberships = nextStory.memberships.filter((membership) => !(membership.kind === "holds-key" && membership.groupId === selectedKeyId && !holderIds.includes(membership.subjectId)));
  const assigned = new Set(nextMemberships.filter((membership) => membership.kind === "holds-key" && membership.groupId === selectedKeyId).map(({ subjectId }) => subjectId));
  for (const holderId of holderIds) if (!assigned.has(holderId)) nextMemberships.push({ subjectId: holderId, groupId: selectedKeyId, kind: "holds-key", source: "manual" });
  return { ...metadataProject, story: { ...nextStory, world: nextWorld, memberships: nextMemberships } };
}
