import { storyRefKey, type StoryObjectRef, type StoryPropertyValue } from "../types";

export type StoryEntityOption = { id: string; name: string; value: StoryObjectRef | { entityId: string } };
type NamedEntry = { id: string; name: string };

export function storyEntityOptions(world: readonly NamedEntry[], objects: readonly { ref: StoryObjectRef; name: string }[]): StoryEntityOption[] {
  return [
    ...world.map(({ id, name }) => ({ id: `entryId:${id}`, name, value: { entityId: id } })),
    ...objects.map(({ ref, name }) => ({ id: storyRefKey(ref), name, value: ref })),
  ];
}

export function storyEntityOptionId(value: StoryPropertyValue | undefined): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  if ("entityId" in value && typeof value.entityId === "string") return `entryId:${value.entityId}`;
  if ("kind" in value && typeof value.kind === "string" && typeof value.id === "string") return storyRefKey(value as StoryObjectRef);
  return "";
}

export function storyEntityValue(id: string, options: readonly StoryEntityOption[]): StoryPropertyValue {
  return options.find((option) => option.id === id)?.value ?? null;
}
