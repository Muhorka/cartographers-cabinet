import type { KernelPoint, RoomFace, WallNetworkResult } from "../geometry/geometry-types";
import type { ConstructionSurface, DrawingElement, EditorProject, PlaceNode, RegionShape } from "../model/project-model";
import { regionBounds } from "../geometry/region-transform";
import { bezierPathData } from "../geometry/bezier-geometry";
import type { ConstructionDocument } from "../construction/construction-document";
import type { VerticalTransition } from "../construction/wall-features";
import { assessRegionConstraint } from "../geometry/region-constraints";
import { relativePlaceMatrix, type AffineMatrix } from "../geometry/affine-transform";

export type SheetViewport = { center: KernelPoint; zoom: number; rotation: number };
export { relativePlaceMatrix } from "../geometry/affine-transform";

export function matrixAttribute([a, b, c, d, e, f]: AffineMatrix) {
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

export function regionPath(shape: RegionShape) {
  if (shape.kind === "compound") return shape.polygons.flatMap(({ outer, holes }) => [pointsPath(outer, true), ...holes.map((hole) => pointsPath(hole, true))]).join(" ");
  if (shape.kind === "rectangle") return `M ${shape.x} ${shape.y} h ${shape.width} v ${shape.height} h ${-shape.width} Z`;
  if (shape.kind === "circle") return `M ${shape.cx - shape.radius} ${shape.cy} a ${shape.radius} ${shape.radius} 0 1 0 ${shape.radius * 2} 0 a ${shape.radius} ${shape.radius} 0 1 0 ${-shape.radius * 2} 0 Z`;
  if (shape.kind === "ellipse") return `M ${shape.cx - shape.rx} ${shape.cy} a ${shape.rx} ${shape.ry} 0 1 0 ${shape.rx * 2} 0 a ${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx * 2} 0 Z`;
  if (shape.kind === "bezier") return bezierPathData(shape.nodes, true);
  return pointsPath(shape.points, true);
}

export function pointsPath(points: KernelPoint[], closed: boolean) {
  if (!points.length) return "";
  return `M ${points.map(({ x, y }) => `${x} ${y}`).join(" L ")}${closed ? " Z" : ""}`;
}

export function roomPath(face: RoomFace) {
  return [pointsPath(face.outer, true), ...face.holes.map((hole) => pointsPath(hole, true))].join(" ");
}

export function visiblePlaceGroups(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId); if (!active) return { active: undefined, children: [], descendants: [], context: [] };
  const byId = new Map(project.places.map((place) => [place.id, place])); const context = new Map<string, PlaceNode>(); let current = active;
  while (current.parentId) {
    const parent = byId.get(current.parentId); if (!parent) break;
    context.set(parent.id, parent);
    for (const sibling of project.places.filter((candidate) => candidate.parentId === parent.id && candidate.id !== current.id)) context.set(sibling.id, sibling);
    current = parent;
  }
  const children = project.places.filter(({ parentId }) => parentId === active.id);
  const descendants = active.kind === "world" || active.kind === "location" || active.kind === "custom"
    ? children.flatMap((child) => project.places.filter(({ parentId, kind }) => parentId === child.id && (kind === "location" || kind === "building" || kind === "custom")))
    : [];
  return { active, children, descendants, context: [...context.values()] };
}

function hierarchyDistance(project: EditorProject, fromId: string, toId: string) {
  const byId = new Map(project.places.map((place) => [place.id, place]));
  let current = byId.get(toId); let distance = 0;
  while (current) {
    if (current.id === fromId) return distance;
    current = current.parentId ? byId.get(current.parentId) : undefined; distance += 1;
  }
  return undefined;
}

export function elementContextDepth(project: EditorProject, activePlaceId: string, element: DrawingElement) {
  if (element.belongsToId === activePlaceId) return 0;
  const below = hierarchyDistance(project, activePlaceId, element.belongsToId);
  const above = hierarchyDistance(project, element.belongsToId, activePlaceId);
  if (element.layerId !== "sketch") {
    if (below !== undefined && below <= 2) return below;
    if (above !== undefined && above <= 2) return -above;
  }
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = project.places.find(({ id }) => id === element.belongsToId);
  return active?.kind === "level" && owner?.kind === "room" && owner.parentId === active.id ? 1 : undefined;
}

export function surfaceContextDepth(project: EditorProject, activePlaceId: string, surface: ConstructionSurface) {
  if (surface.belongsToId === activePlaceId) return 0;
  const below = hierarchyDistance(project, activePlaceId, surface.belongsToId);
  const above = hierarchyDistance(project, surface.belongsToId, activePlaceId);
  if (below !== undefined && below <= 2) return below;
  if (above !== undefined && above <= 2) return -above;
  return undefined;
}

export type TransitionView = { transition: VerticalTransition; transform?: AffineMatrix };

/** Returns one context copy of every transition whose connection includes the open level. */
export function connectedTransitionsForView(project: EditorProject, activeLevelId: string, activeConstructionId?: string): TransitionView[] {
  const result: TransitionView[] = [];
  for (const document of project.constructions) {
    if (document.id === activeConstructionId) continue;
    const owner = project.places.find(({ constructionId }) => constructionId === document.id);
    if (!owner) continue;
    for (const transition of document.transitions) {
      const connected = new Set([transition.sourceLevelId, transition.targetLevelId, ...(transition.connectedLevelIds ?? [])].filter(Boolean));
      if (!connected.has(activeLevelId)) continue;
      result.push({ transition, transform: relativePlaceMatrix(project, activeLevelId, owner.id) });
    }
  }
  return result;
}

export function viewportRegion(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  if (!active) return undefined;
  if (active.kind === "room" && active.parentId) {
    return project.places.find(({ id }) => id === active.parentId)?.boundary ?? active.boundary;
  }
  return active.boundary;
}

export function constructionPlaceForView(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  if (active?.kind === "room" && active.parentId) {
    const level = project.places.find(({ id }) => id === active.parentId);
    if (level?.constructionId) return level;
  }
  if (active?.kind === "building") return project.places.find(({ parentId, kind, constructionId }) => parentId === active.id && kind === "level" && constructionId);
  return active?.constructionId ? active : undefined;
}

export function roomEditingScope(active: PlaceNode | undefined, document: ConstructionDocument | undefined, network: WallNetworkResult | undefined) {
  if (active?.kind !== "room" || !document || !network) return {};
  const room = document.rooms.find(({ id }) => id === active.id);
  const face = room ? network.faces.find(({ id }) => id === room.faceId) : undefined;
  const wallIds = new Set(face?.wallIds ?? []);
  const transitionIds = active.boundary ? new Set(document.transitions.filter(({ footprint }) => assessRegionConstraint(footprint, active.boundary).state === "inside").map(({ id }) => id)) : new Set<string>();
  return { wallIds, transitionIds };
}

export function panViewport(viewport: SheetViewport, screenDelta: KernelPoint): SheetViewport {
  const radians = -viewport.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const x = (screenDelta.x * cosine - screenDelta.y * sine) / viewport.zoom; const y = (screenDelta.x * sine + screenDelta.y * cosine) / viewport.zoom;
  return { ...viewport, center: { x: viewport.center.x - x, y: viewport.center.y - y } };
}

export function zoomViewport(viewport: SheetViewport, factor: number, anchor: KernelPoint, sheetCenter: KernelPoint): SheetViewport {
  const zoom = Math.min(10_000, Math.max(0.0001, viewport.zoom * factor)); const radians = -viewport.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const local = { x: anchor.x - sheetCenter.x, y: anchor.y - sheetCenter.y };
  const rotated = { x: local.x * cosine - local.y * sine, y: local.x * sine + local.y * cosine };
  return { ...viewport, zoom, center: { x: viewport.center.x + rotated.x * (1 / viewport.zoom - 1 / zoom), y: viewport.center.y + rotated.y * (1 / viewport.zoom - 1 / zoom) } };
}

export function fitViewportToRegion(shape?: RegionShape, sheetSize = { width: 1000, height: 700 }, padding = .16): SheetViewport {
  if (!shape) return { center: { x: 0, y: 0 }, zoom: 6, rotation: 0 };
  const bounds = regionBounds(shape); const width = Math.max(bounds.maxX - bounds.minX, .001); const height = Math.max(bounds.maxY - bounds.minY, .001);
  const usableWidth = sheetSize.width * (1 - padding * 2); const usableHeight = sheetSize.height * (1 - padding * 2);
  return {
    center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    zoom: Math.min(usableWidth / width, usableHeight / height),
    rotation: 0,
  };
}
