import type { StoryLens } from "./types";

/** Transient presentation only: never part of the project or its undo history. */
export type StoryLensView = { activeLensId?: string; activeLensIds?: string[]; previewLens?: StoryLens };

export function activeStoryLensIds(view: StoryLensView): string[] {
  return [...new Set(view.activeLensIds ?? (view.activeLensId ? [view.activeLensId] : []))];
}

/** Keep the old single-lens entry point as a replace-selection adapter. */
export function patchStoryLensView<T extends StoryLensView>(current: T, patch: Partial<T>): T {
  const next = { ...current, ...patch };
  if ("activeLensIds" in patch) {
    next.activeLensIds = [...new Set(patch.activeLensIds ?? [])];
    next.activeLensId = next.activeLensIds[0];
  } else if ("activeLensId" in patch) {
    next.activeLensIds = patch.activeLensId ? [patch.activeLensId] : [];
  }
  if ("previewLens" in patch) next.previewLens = patch.previewLens ? structuredClone(patch.previewLens) : undefined;
  return next;
}

export function visibleStoryLenses(lenses: readonly StoryLens[], view: StoryLensView): StoryLens[] {
  const selected = new Set(activeStoryLensIds(view));
  return [...lenses.filter(({ id }) => selected.has(id)), ...(view.previewLens ? [view.previewLens] : [])];
}
