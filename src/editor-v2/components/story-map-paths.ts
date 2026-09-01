import type { EditorProject } from "../model/project-model";
import type { StoryObjectRef } from "../story/types";
import { bezierPathData } from "../geometry/bezier-geometry";
import { isRibbonElement, ribbonShape } from "../geometry/ribbon-geometry";
import { constructionPlaceForView, elementContextDepth, matrixAttribute, pointsPath, regionPath, relativePlaceMatrix, surfaceContextDepth, visiblePlaceGroups } from "./map-sheet-geometry";

export function storyMapPath(project: EditorProject, activePlaceId: string, ref: StoryObjectRef, zoom: number): { path: string; transform: string; closed: boolean } | undefined {
  const transform = (ownerId: string) => matrixAttribute(relativePlaceMatrix(project, activePlaceId, ownerId));
  if (ref.kind === "place" || ref.kind === "room") {
    const place = project.places.find(({ id }) => id === ref.id); if (!place?.boundary || place.visible === false) return;
    const groups = visiblePlaceGroups(project, activePlaceId);
    const visible = [groups.active, ...groups.children, ...groups.context, ...groups.descendants].some((item) => item?.id === place.id);
    const owner = constructionPlaceForView(project, activePlaceId);
    if (ref.kind === "room" ? place.parentId !== owner?.id && place.id !== activePlaceId : !visible || place.kind === "level" && place.id !== activePlaceId) return;
    return { path: regionPath(place.boundary), transform: transform(place.id), closed: true };
  }
  if (ref.kind === "element") {
    const element = project.elements.find(({ id }) => id === ref.id); if (!element?.visible || elementContextDepth(project, activePlaceId, element) === undefined) return;
    const geometry = element.geometry; const ribbon = isRibbonElement(element) ? ribbonShape(element) : undefined;
    if (ribbon) return { path: regionPath(ribbon), transform: transform(element.belongsToId), closed: true };
    const path = geometry.kind === "region" ? regionPath(geometry.shape) : geometry.kind === "path" ? pointsPath(geometry.points, geometry.closed) : geometry.kind === "bezier" ? bezierPathData(geometry.nodes, geometry.closed)
      : regionPath({ kind: "circle", cx: geometry.at.x, cy: geometry.at.y, radius: 4 / zoom });
    return { path, transform: transform(element.belongsToId), closed: geometry.kind === "region" || !(geometry.kind === "path" || geometry.kind === "bezier") || geometry.closed };
  }
  if (ref.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === ref.id); if (!surface?.visible || surfaceContextDepth(project, activePlaceId, surface) === undefined) return;
    return { path: regionPath(surface.shape), transform: transform(surface.belongsToId), closed: true };
  }
  const doc = project.constructions.find(({ id }) => id === ref.scopeId || project.places.some((place) => place.id === ref.scopeId && place.constructionId === id));
  const owner = project.places.find(({ constructionId }) => constructionId === doc?.id);
  const visibleOwner = constructionPlaceForView(project, activePlaceId);
  if (!doc || !owner) return;
  if (ref.kind === "transition") {
    const transition = doc.transitions.find(({ id }) => id === ref.id); if (!transition || transition.visible === false) return;
    if (visibleOwner?.id !== owner.id && !transition.connectedLevelIds?.includes(visibleOwner?.id ?? "")) return;
    return { path: regionPath(transition.footprint), transform: transform(owner.id), closed: true };
  }
  if (owner.id !== visibleOwner?.id) return;
  const opening = ref.kind === "opening" ? doc.openings.find(({ id }) => id === ref.id) : undefined;
  const wall = doc.walls.find(({ id }) => id === (opening?.wallId ?? ref.id)); if (!wall || wall.visible === false || opening?.visible === false) return;
  if (!opening) return { path: pointsPath([wall.start, wall.end], false), transform: transform(owner.id), closed: false };
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y); if (!length) return;
  const point = (t: number) => ({ x: wall.start.x + (wall.end.x - wall.start.x) * t, y: wall.start.y + (wall.end.y - wall.start.y) * t });
  return { path: pointsPath([point(opening.position - opening.width / length / 2), point(opening.position + opening.width / length / 2)], false), transform: transform(owner.id), closed: false };
}
