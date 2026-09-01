import { sampleBezier } from "../geometry/bezier-geometry";
import { applyAffinePoint, relativePlaceMatrix, transformRegion, type AffineMatrix } from "../geometry/affine-transform";
import { moveSelection, type EditableSelection } from "../drawing/selection-operations";
import { selectionIsLocked } from "../drawing/selection-locks";
import type { KernelPoint } from "../geometry/geometry-types";
import type { EditorProject, DrawingElement } from "../model/project-model";
import { isRibbonElement, ribbonShape } from "../geometry/ribbon-geometry";
import { alignmentDeltas, distributionDeltas, regionBounds, type AlignmentEdge, type PlanningAxis, type PlanningBounds, type PlanningItem } from "./planning-geometry";

export type PlanningIdentity = { createId(): string; createRoomName(index: number): string };
export type PlanningFrame = PlanningItem & { selection: EditableSelection; moveSpaceId: string };

function vector(matrix: AffineMatrix, point: KernelPoint): KernelPoint { return { x: matrix[0] * point.x + matrix[2] * point.y, y: matrix[1] * point.x + matrix[3] * point.y }; }
function pointsBounds(points: KernelPoint[]): PlanningBounds | undefined { if (!points.length) return undefined; return points.reduce<PlanningBounds>((result, point) => ({ minX: Math.min(result.minX, point.x), minY: Math.min(result.minY, point.y), maxX: Math.max(result.maxX, point.x), maxY: Math.max(result.maxY, point.y) }), { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y }); }

function geometryBounds(project: EditorProject, geometry: DrawingElement["geometry"], sourceId: string, activePlaceId: string, element?: DrawingElement): PlanningBounds | undefined {
  const matrix = relativePlaceMatrix(project, activePlaceId, sourceId);
  if (element && isRibbonElement(element)) {
    const ribbon = ribbonShape(element);
    if (ribbon) return regionBounds(transformRegion(matrix, ribbon));
  }
  if (geometry.kind === "region") return regionBounds(transformRegion(matrix, geometry.shape));
  if (geometry.kind === "path") return pointsBounds(geometry.points.map((point) => applyAffinePoint(matrix, point)));
  if (geometry.kind === "bezier") return pointsBounds(sampleBezier(geometry.nodes, geometry.closed).map((point) => applyAffinePoint(matrix, point)));
  const point = geometry.at; const width = geometry.kind === "note" ? geometry.width ?? 18 : 0; const height = geometry.kind === "note" ? geometry.height ?? 8 : 0;
  return pointsBounds([{ x: point.x, y: point.y }, { x: point.x + width, y: point.y + height }].map((candidate) => applyAffinePoint(matrix, candidate)));
}

function placeLineageContains(project: EditorProject, ancestorId: string, placeId: string) {
  const byId = new Map(project.places.map((place) => [place.id, place])); let current = byId.get(placeId);
  while (current) { if (current.id === ancestorId) return true; current = current.parentId ? byId.get(current.parentId) : undefined; }
  return false;
}

function constructionOwner(project: EditorProject, roomId: string) {
  const document = project.constructions.find(({ rooms }) => rooms.some(({ id }) => id === roomId));
  return document ? { document, place: project.places.find(({ constructionId }) => constructionId === document.id) } : undefined;
}

/** Resolves selected objects into one active-place coordinate system. Unsupported structural selections are omitted. */
export function planningSelectionFrames(project: EditorProject, activePlaceId: string, selections: EditableSelection[]): PlanningFrame[] {
  const placeIds = new Set(selections.filter(({ kind }) => kind === "place").map(({ id }) => id)); const frames: PlanningFrame[] = [];
  for (const selection of selections) {
    let bounds: PlanningBounds | undefined; let moveSpaceId: string | undefined;
    if (selection.kind === "place") {
      const place = project.places.find(({ id }) => id === selection.id); if (!place?.boundary || !place.parentId || placeLineageContains(project, selection.id, activePlaceId)) continue;
      bounds = regionBounds(transformRegion(relativePlaceMatrix(project, activePlaceId, place.id), place.boundary)); moveSpaceId = place.parentId;
    } else if (selection.kind === "element") {
      const element = project.elements.find(({ id }) => id === selection.id); if (!element || [...placeIds].some((placeId) => placeLineageContains(project, placeId, element.belongsToId))) continue;
      bounds = geometryBounds(project, element.geometry, element.belongsToId, activePlaceId, element); moveSpaceId = element.belongsToId;
    } else if (selection.kind === "surface") {
      const surface = project.surfaces.find(({ id }) => id === selection.id); if (!surface || [...placeIds].some((placeId) => placeLineageContains(project, placeId, surface.belongsToId))) continue;
      bounds = regionBounds(transformRegion(relativePlaceMatrix(project, activePlaceId, surface.belongsToId), surface.shape)); moveSpaceId = surface.belongsToId;
    } else if (selection.kind === "room") {
      const owner = constructionOwner(project, selection.id); const roomPlace = project.places.find(({ id }) => id === selection.id); if (!owner?.place || !roomPlace?.boundary || placeIds.has(owner.place.id)) continue;
      bounds = regionBounds(transformRegion(relativePlaceMatrix(project, activePlaceId, owner.place.id), roomPlace.boundary)); moveSpaceId = owner.place.id;
    }
    if (bounds && moveSpaceId) frames.push({ id: `${selection.kind}:${selection.id}`, selection, bounds, moveSpaceId });
  }
  return frames;
}

export type PlanningApplyResult = { state: "applied"; project: EditorProject } | { state: "blocked"; project: EditorProject; reason: "locked" | "unsupported" | "outside-outline" | "collision" };

/** Plans every move first and commits only when every selected item can move. */
export function applyPlanningAlignment(project: EditorProject, activePlaceId: string, selections: EditableSelection[], mode: { kind: "align"; axis: PlanningAxis; edge: AlignmentEdge } | { kind: "distribute"; axis: PlanningAxis }, boundaryEditing: boolean, identity: PlanningIdentity): PlanningApplyResult {
  const frames = planningSelectionFrames(project, activePlaceId, selections);
  if (frames.length !== selections.length || frames.length < (mode.kind === "align" ? 2 : 3)) return { state: "blocked", project, reason: "unsupported" };
  if (frames.some(({ selection }) => selectionIsLocked(project, selection))) return { state: "blocked", project, reason: "locked" };
  const items = frames.map(({ id, bounds }) => ({ id, bounds })); const deltas = mode.kind === "align" ? alignmentDeltas(items, mode.axis, mode.edge) : distributionDeltas(items, mode.axis); let next = project;
  for (const frame of frames) {
    const delta = vector(relativePlaceMatrix(project, frame.moveSpaceId, activePlaceId), deltas[frame.id] ?? { x: 0, y: 0 });
    const result = moveSelection(next, { activePlaceId, selection: frame.selection, delta, boundaryEditing }, identity);
    if (result.state === "blocked") return { state: "blocked", project, reason: result.reason === "outside-outline" ? "outside-outline" : result.reason === "collision" ? "collision" : "unsupported" };
    next = result.state === "review-required" ? result.accept() : result.project;
  }
  return { state: "applied", project: next };
}

export type { AlignmentEdge, PlanningAxis } from "./planning-geometry";
