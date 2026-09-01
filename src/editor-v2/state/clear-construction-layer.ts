import { constructionNetwork, previewWallReplacement } from "../construction/construction-document";
import { relativePlaceMatrix, transformDrawingGeometry } from "../geometry/affine-transform";
import { assessPathConstraint } from "../geometry/path-constraints";
import { assessRegionConstraint } from "../geometry/region-constraints";
import { roomFaceShape } from "../geometry/room-face-shape";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import type { EditorProject } from "../model/project-model";
import { workLayerAvailability } from "../model/work-context";

type Identity = { createId(): string; createName(index: number): string };

/** The construction sub-layer shown by the clear confirmation. */
export type ConstructionClearCategory = "all" | "walls" | "openings" | "vertical-connections" | "platforms" | "doors" | "windows" | "gates" | "passages";

/** Keep this list separate from the legacy `all` compatibility mode. */
export const constructionClearCategories: readonly Exclude<ConstructionClearCategory, "all" | "openings">[] = ["walls", "vertical-connections", "platforms", "doors", "windows", "gates", "passages"];
export const constructionClearApiCategories: readonly Exclude<ConstructionClearCategory, "all">[] = [...constructionClearCategories, "openings"];

/** Clear the visible structural layer, never its containing outline. */
export function clearConstructionLayer(project: EditorProject, activePlaceId: string, identity: Identity, category: ConstructionClearCategory = "all"): EditorProject {
  const active = project.places.find(({ id }) => id === activePlaceId);
  if (!active || active.locked) return project;
  const availability = workLayerAvailability(project, activePlaceId, "construction");
  if (!availability.available) return project;
  const document = project.constructions.find(({ id }) => id === availability.constructionId);
  const level = document && project.places.find(({ constructionId }) => constructionId === document.id);
  const owners = new Set([activePlaceId, availability.targetPlaceId]);
  if (active.kind !== "room" && level) {
    owners.add(level.id);
    project.places.filter(({ parentId, kind }) => parentId === level.id && kind === "room").forEach(({ id }) => owners.add(id));
  }
  const clearPlatforms = category === "all" || category === "platforms";
  const clearWalls = category === "all" || category === "walls";
  const clearOpenings = category === "all" || category === "openings" || ["doors", "windows", "gates", "passages"].includes(category);
  const clearTransitions = category === "all" || category === "vertical-connections";
  const surfaces = clearPlatforms ? project.surfaces.filter((surface) => surface.locked || !owners.has(surface.belongsToId)) : project.surfaces;
  let next = surfaces.length === project.surfaces.length ? project : { ...project, surfaces };
  if (!document || !level) return next;
  const network = constructionNetwork(document.walls, document.enclosure);
  const room = active.kind === "room" ? document.rooms.find(({ id }) => id === active.id) : undefined;
  const face = room && network.faces.find(({ id }) => id === room.faceId);
  if (active.kind === "room" && !face) return next;
  const enclosure = face ? roomFaceShape(face) : undefined;
  const protectedWalls = new Set(face?.wallIds ?? []);
  // A locked room also protects the geometry that defines it.
  for (const record of document.rooms.filter((candidate) => candidate.locked || project.places.find(({ id }) => id === candidate.id)?.locked)) {
    network.faces.find(({ id }) => id === record.faceId)?.wallIds.forEach((id) => protectedWalls.add(id));
  }
  // A locked opening cannot survive without its wall, so its wall is protected too.
  document.openings.filter(({ locked }) => locked).forEach(({ wallId }) => protectedWalls.add(wallId));
  const removable = new Set(clearWalls ? document.walls.filter((wall) => wall.role !== "boundary" && !wall.locked && !protectedWalls.has(wall.id)
    && (!enclosure || assessPathConstraint([wall.start, wall.end], enclosure).state === "inside")).map(({ id }) => id) : []);
  const changedWalls = removable.size ? previewWallReplacement(document, document.walls.filter(({ id }) => !removable.has(id)), identity) : undefined;
  if (changedWalls?.effects.some(({ kind }) => kind === "geometry-conflict")) return project;
  const base = changedWalls?.after ?? document;
  const openings = base.openings.filter((opening) => {
    const wall = document.walls.find(({ id }) => id === opening.wallId);
    const wallRemoved = !base.walls.some(({ id }) => id === opening.wallId);
    const inActiveRoom = !enclosure || face!.wallIds.includes(opening.wallId);
    const removeForCategory = clearOpenings && inActiveRoom && (category === "all" || category === "openings" || category === `${opening.kind}s`);
    return opening.locked || wall?.locked || (!wallRemoved && !removeForCategory);
  });
  const changed = base !== document || openings.length !== document.openings.length;
  const updated = changed ? { ...base, revision: document.revision + 1, openings } : document;
  if (changed) next = syncConstructionRooms({ ...next, constructions: next.constructions.map((candidate) => candidate.id === document.id ? updated : candidate) }, updated);

  // A stair is one connection drawn on several floors, not independent copies.
  // Clear the same source record whether this sheet is its start or destination.
  const constructions = next.constructions.map((candidate) => {
    const source = project.places.find(({ constructionId }) => constructionId === candidate.id);
    const transitions = candidate.transitions.filter((transition) => {
      if (!clearTransitions || transition.locked) return true;
      const linked = transition.connectedLevelIds ?? [transition.sourceLevelId, transition.targetLevelId];
      const onSheet = candidate.id === document.id || (!transition.sameLevelRise && linked.includes(level.id));
      if (!onSheet) return true;
      if (!enclosure) return false;
      if (!source) return true;
      const geometry = transformDrawingGeometry(relativePlaceMatrix(project, level.id, source.id), { kind: "region", shape: transition.footprint });
      return geometry.kind !== "region" || assessRegionConstraint(geometry.shape, enclosure).state !== "inside";
    });
    return transitions.length === candidate.transitions.length ? candidate : { ...candidate, revision: candidate.revision + 1, transitions };
  });
  return constructions.some((candidate, index) => candidate !== next.constructions[index]) ? { ...next, constructions } : next;
}
