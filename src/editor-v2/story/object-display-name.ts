import type { SheetObjectListCopy } from "../components/sheet-object-list";
import type { EditorProject } from "../model/project-model";
import type { ResolvedStoryObject } from "./project-adapter";
import { sameStoryRef, type StoryData, type StoryObjectRef } from "./types";

type DisplayObject = Pick<ResolvedStoryObject, "ref" | "name"> & { metadata?: ResolvedStoryObject["metadata"]; ownerPlaceId?: string };

/** Prefers an explicitly authored base Story label without changing its technical source. */
export function authoredStoryObjectLabel(story: StoryData, ref: StoryObjectRef, fallback: string): string {
  return story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata.narrativeLabel?.trim() || fallback;
}

function generatedName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy) {
  const construction = object.ref.scopeId && project.constructions.find(({ id }) => id === object.ref.scopeId);
  if (!construction) return undefined;
  if (object.ref.kind === "wall") {
    const index = construction.walls.findIndex(({ id }) => id === object.ref.id); return index < 0 ? undefined : { label: copy.wallName(index + 1), source: `Wall ${object.ref.id}` };
  }
  if (object.ref.kind === "opening") {
    const opening = construction.openings.find(({ id }) => id === object.ref.id); const index = construction.openings.findIndex(({ id }) => id === object.ref.id); return opening && index >= 0 ? { label: copy.openingName(opening.kind, index + 1), source: `${opening.kind} ${opening.id}` } : undefined;
  }
  if (object.ref.kind === "transition") {
    const transition = construction.transitions.find(({ id }) => id === object.ref.id); const index = construction.transitions.findIndex(({ id }) => id === object.ref.id); if (!transition || index < 0) return undefined;
    return { label: transition.kind === "elevator" ? copy.elevatorName?.(index + 1) ?? copy.stairsName(index + 1) : copy.stairsName(index + 1), source: `${transition.kind} ${transition.id}` };
  }
  return undefined;
}

function disambiguatingLevel(project: EditorProject, object: DisplayObject) {
  if (!object.ref.scopeId) return undefined;
  const hasDuplicate = project.constructions.filter((construction) => object.ref.kind === "wall" ? construction.walls.some(({ id }) => id === object.ref.id) : object.ref.kind === "opening" ? construction.openings.some(({ id }) => id === object.ref.id) : construction.transitions.some(({ id }) => id === object.ref.id)).length > 1;
  if (!hasDuplicate) return undefined;
  const levels = project.places.filter(({ constructionId, kind }) => constructionId === object.ref.scopeId && kind === "level");
  if (object.ownerPlaceId) { const owner = project.places.find(({ id, kind }) => id === object.ownerPlaceId && kind === "level"); if (owner) return owner.name; }
  return levels.length === 1 ? levels[0]?.name : undefined;
}

/** Returns a stable, localized display name without changing authored source data. */
export function storyObjectDisplayName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy): string {
  if (!["wall", "opening", "transition"].includes(object.ref.kind)) return object.name;
  const generated = generatedName(project, object, copy); if (!generated) return object.name;
  if (object.metadata?.narrativeLabel || object.name !== generated.source) return object.name;
  const level = disambiguatingLevel(project, object); return level ? `${generated.label} · ${level}` : generated.label;
}
