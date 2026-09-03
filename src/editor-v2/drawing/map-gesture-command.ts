import { roomFaceShape } from "../geometry/room-face-shape";
import { constructionNetwork } from "../construction/construction-network";

import { commitConstructionTransaction, previewWallAddition } from "../construction/construction-document";
import { placeVerticalTransition, placeWallOpening, type VerticalTransition, type WallOpening } from "../construction/wall-features";
import { appendDraftStroke, consumedDraftStrokes, createSemanticDraft, looseDraftStrokes, type SemanticDraft } from "../draft/semantic-draft";
import { completeSemanticDraft } from "../draft/complete-draft";
import { applyClosedRegionGesture } from "./closed-region-gesture";
import { assessPathConstraint } from "../geometry/path-constraints";
import { assessRegionConstraint, pointInRegion, shapePoints } from "../geometry/region-constraints";
import { addElement, syncConstructionRooms } from "../model/hierarchy-operations";
import type { DrawingElement, EditorProject, RegionShape } from "../model/project-model";
import { workLayerAvailability } from "../model/work-context";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { noteBoxFromPoints, type MapGesture } from "../components/map-sheet-gesture";
import { arcBezierNodes, gestureSegments, regionFromGesture } from "./gesture-geometry";
import { eraseCurrentLayer } from "./semantic-eraser";
import { sampleBezier } from "../geometry/bezier-geometry";
import { snapConstructionPath } from "./construction-snapping";
import { normalizeDraftTopology } from "../draft/normalize-draft-topology";
import { objectOwnerForPoint } from "./object-ownership";
import { constructionWallsForPlace } from "../draft/construction-context";
import { applySketchGesture } from "./sketch-gesture-command";
import { applyRoadGesture } from "../roads/road-gesture";
import { applyRibbonGesture } from "./ribbon-gesture";
import { isRibbonSubject } from "../geometry/ribbon-geometry";
import { smoothPencilGesture } from "../geometry/pencil-smoothing";
export { saveGestureDraftAsSketch, savePendingDraftAsPath, savePendingDraftAsSketch } from "./gesture-draft-save";
export type { Identity, Naming } from "./map-gesture-command-types";

type Selection = { kind: "place" | "element" | "surface" | "room" | "wall" | "opening" | "transition"; id: string; scopeId?: string };
import type { Identity, Naming } from "./map-gesture-command-types";
export type MapGestureCommandInput = {
  activePlaceId: string;
  layerId: WorkLayerId;
  subjectId: string;
  widthMeters?: number;
  gesture: MapGesture;
  boundaryEditing: boolean;
  pendingDraft?: SemanticDraft;
  acceptClip?: boolean;
  transition?: Partial<Pick<VerticalTransition, "sourceLevelId" | "targetLevelId" | "connectedLevelIds" | "style" | "direction" | "sameLevelRise">>;
};

export type MapGestureCommandResult =
  | { state: "applied"; project: EditorProject; selection?: Selection; pendingDraft?: SemanticDraft }
  | { state: "draft-updated"; project: EditorProject; pendingDraft: SemanticDraft }
  | { state: "clip-review"; project: EditorProject; pendingDraft?: SemanticDraft }
  | { state: "review-required"; project: EditorProject; candidateIds: string[] }
  | { state: "transition-config-required"; project: EditorProject }
  | { state: "blocked"; project: EditorProject; reason: "unavailable-here" | "outside-outline" | "geometry-conflict" | "no-wall" | "stairs-need-room" | "bezier-pending" | "road-obstacle" }
  | { state: "nothing"; project: EditorProject };

const regionLayers = new Set<WorkLayerId>(["terrain", "boundaries", "buildings", "equipment"]);
function closedPoints(shape: RegionShape) {
  const points = shapePoints(shape);
  return [...points, points[0]];
}
function sparsePoints(points: MapGesture["points"], spacing = .2) {
  return points.reduce((kept, point, index) => {
    const previous = kept.at(-1);
    if (!previous || index === points.length - 1 || Math.hypot(point.x - previous.x, point.y - previous.y) >= spacing) kept.push(point);
    return kept;
  }, [] as MapGesture["points"]);
}
function snapStroke(points: MapGesture["points"], draft: SemanticDraft, tolerance = 1.25) {
  const simplified = sparsePoints(points);
  if (simplified.length < 2) return simplified;
  const anchors = draft.strokes.flatMap(({ points: stroke }) => [stroke[0], stroke.at(-1)!]);
  const segments = draft.strokes.flatMap(({ points: stroke }) => stroke.slice(1).map((end, index) => ({ start: stroke[index], end })));
  const projectedCandidates = (point: MapGesture["points"][number]) => segments.map(({ start, end }) => projectPointToSegment(point, start, end));
  const snap = (point: MapGesture["points"][number], candidates: MapGesture["points"]) => candidates
    .map((candidate) => ({ candidate, distance: Math.hypot(point.x - candidate.x, point.y - candidate.y) }))
    .toSorted((first, second) => first.distance - second.distance)[0];
  const firstMatch = snap(simplified[0], [...anchors, ...projectedCandidates(simplified[0])]);
  if (firstMatch && firstMatch.distance <= tolerance) simplified[0] = firstMatch.candidate;
  const endCandidates = [...anchors, simplified[0]];
  const lastIndex = simplified.length - 1;
  const lastMatch = snap(simplified[lastIndex], [...endCandidates, ...projectedCandidates(simplified[lastIndex])]);
  if (lastMatch && lastMatch.distance <= tolerance) simplified[lastIndex] = lastMatch.candidate;
  return simplified;
}

function projectPointToSegment(point: MapGesture["points"][number], start: MapGesture["points"][number], end: MapGesture["points"][number]) {
  const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return start;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return { x: start.x + dx * t, y: start.y + dy * t };
}

function matchingDraft(input: MapGestureCommandInput, targetPlaceId: string, identity: Identity) {
  const current = input.pendingDraft;
  if (current && current.layerId === input.layerId && current.subjectId === input.subjectId && current.belongsToId === targetPlaceId) return current;
  return createSemanticDraft(identity.createId(), input.layerId, input.subjectId, targetPlaceId);
}
function selectionFor(project: EditorProject, id: string): Selection {
  if (project.places.some((place) => place.id === id)) return { kind: "place", id };
  return project.surfaces.some((surface) => surface.id === id) ? { kind: "surface", id } : { kind: "element", id };
}
function completeDraft(project: EditorProject, draft: SemanticDraft, input: MapGestureCommandInput, identity: Identity, naming: Naming): MapGestureCommandResult {
  const completed = completeSemanticDraft(project, draft, identity, { nameFor: naming.nameFor, levelName: naming.levelName, roomName: identity.createRoomName }, input.acceptClip);
  if (completed.state === "incomplete") return { state: "draft-updated", project, pendingDraft: draft };
  if (completed.state === "clip-review") return { state: "clip-review", project, pendingDraft: draft };
  if (completed.state === "outside") return { state: "blocked", project, reason: "outside-outline" };
  if (completed.state !== "created") return { state: "blocked", project, reason: "geometry-conflict" };
  const strokes = draft.layerId === "construction" && draft.subjectId.startsWith("platform.")
    ? looseDraftStrokes({ ...draft, strokes: consumedDraftStrokes(draft, constructionWallsForPlace(project, draft.belongsToId)) }, input.gesture.snapTolerance)
    : looseDraftStrokes(draft, input.gesture.snapTolerance);
  const pendingDraft = strokes.length ? { ...draft, id: identity.createId(), strokes } : undefined;
  return { state: "applied", project: completed.project, selection: completed.createdIds[0] ? selectionFor(completed.project, completed.createdIds[0]) : undefined, ...(pendingDraft ? { pendingDraft } : {}) };
}

function addDrawingElement(project: EditorProject, targetPlaceId: string, element: Omit<DrawingElement, "belongsToId">) {
  return addElement(project, element, targetPlaceId);
}

function applyRegionLayer(project: EditorProject, input: MapGestureCommandInput, targetPlaceId: string, identity: Identity, naming: Naming): MapGestureCommandResult {
  if (input.gesture.instrumentId === "pen") {
    const nodes = input.gesture.bezierNodes; if (!nodes || nodes.length < 2) return { state: "nothing", project };
    if (!input.gesture.closed) {
      let draft = matchingDraft(input, targetPlaceId, identity);
      draft = appendDraftStroke(draft, { id: identity.createId(), points: snapStroke(sampleBezier(nodes, false), draft, input.gesture.snapTolerance) });
      draft = normalizeDraftTopology(draft, input.gesture.snapTolerance);
      return completeDraft(project, draft, input, identity, naming);
    }
    return applyClosedRegionGesture(project, input, targetPlaceId, { kind: "bezier", nodes, closed: true }, identity, naming);
  }
  const shape = regionFromGesture(input.gesture.instrumentId, input.gesture.points);
  if (shape && shape.kind !== "polygon") return applyClosedRegionGesture(project, input, targetPlaceId, shape, identity, naming);
  let draft = matchingDraft(input, targetPlaceId, identity);
  const arcPoints = input.gesture.instrumentId === "arc" && input.gesture.points.length >= 3
    ? sampleBezier(input.gesture.bezierNodes ?? arcBezierNodes(input.gesture.points[0], input.gesture.points[1], input.gesture.points[2]), input.gesture.closed ?? false)
    : undefined;
  const points = shape ? closedPoints(shape) : snapStroke(arcPoints ?? input.gesture.points, draft, input.gesture.snapTolerance);
  draft = appendDraftStroke(draft, { id: identity.createId(), points });
  // A sampled arc has several points within the endpoint snap radius. The
  // generic topology normalizer intentionally projects endpoints onto nearby
  // segments, which would fold a smooth arc back onto its own first segment.
  // Its endpoints have already been snapped against the existing draft above;
  // leave this one ordinary stroke intact for later line/arc closure.
  if (input.gesture.instrumentId !== "arc") draft = normalizeDraftTopology(draft, input.gesture.snapTolerance);
  return completeDraft(project, draft, input, identity, naming);
}

function updateConstruction(project: EditorProject, constructionId: string, document: EditorProject["constructions"][number]) {
  return syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === constructionId ? document : candidate) }, document);
}

function applyConstruction(project: EditorProject, input: MapGestureCommandInput, targetPlaceId: string, constructionId: string, identity: Identity): MapGestureCommandResult {
  if (input.gesture.instrumentId === "pen") return { state: "blocked", project, reason: "bezier-pending" };
  const document = project.constructions.find(({ id }) => id === constructionId);
  const target = project.places.find(({ id }) => id === targetPlaceId);
  if (!document || !target) return { state: "blocked", project, reason: "unavailable-here" };
  const shape = regionFromGesture(input.gesture.instrumentId, input.gesture.points);
  const arcPoints = input.gesture.instrumentId === "arc" && input.gesture.points.length >= 3
    ? sampleBezier(input.gesture.bezierNodes ?? arcBezierNodes(input.gesture.points[0], input.gesture.points[1], input.gesture.points[2]), input.gesture.closed ?? false)
    : undefined;
  const rawPaths = (shape ? [closedPoints(shape)] : [[...(arcPoints ?? input.gesture.points), ...(input.gesture.instrumentId === "polygon" ? [input.gesture.points[0]] : [])]])
    .map((path) => snapConstructionPath(path, document.walls, input.gesture.snapTolerance));
  const constrained = rawPaths.flatMap((path) => {
    const result = assessPathConstraint(path, target.boundary);
    if (result.state === "inside") return result.paths;
    if (result.state === "clip-available" && input.acceptClip) return result.paths;
    return [];
  });
  const assessments = rawPaths.map((path) => assessPathConstraint(path, target.boundary));
  if (assessments.every(({ state }) => state === "outside")) return { state: "blocked", project, reason: "outside-outline" };
  if (!input.acceptClip && assessments.some(({ state }) => state === "clip-available")) return { state: "clip-review", project };
  const role = input.subjectId === "construction.wall" ? "wall" : "partition";
  const walls = constrained.flatMap((path) => gestureSegments(identity.createId(), path, role));
  const preview = previewWallAddition(document, walls, { createId: identity.createId, createName: identity.createRoomName });
  const committed = commitConstructionTransaction(document, preview);
  if (committed.state !== "committed") return { state: "blocked", project, reason: "geometry-conflict" };
  return { state: "applied", project: updateConstruction(project, constructionId, committed.document), selection: walls[0] ? { kind: "wall", id: walls[0].id, scopeId: constructionId } : undefined };
}

function applyOpening(project: EditorProject, input: MapGestureCommandInput, targetPlaceId: string, constructionId: string, identity: Identity): MapGestureCommandResult {
  const document = project.constructions.find(({ id }) => id === constructionId);
  if (!document) return { state: "blocked", project, reason: "unavailable-here" };
  const target = project.places.find(({ id }) => id === targetPlaceId);
  const network = constructionNetwork(document.walls, document.enclosure);
  const room = target?.kind === "room" ? document.rooms.find(({ id }) => id === target.id) : undefined;
  const roomFace = room ? network.faces.find(({ id }) => id === room.faceId) : undefined;
  if (input.subjectId === "opening.stairs" || input.subjectId === "opening.elevator") {
    const point = input.gesture.points[0];
    const footprint = regionFromGesture(input.gesture.instrumentId, input.gesture.points) ?? (point ? { kind: "rectangle" as const, x: point.x - 1, y: point.y - 2, width: 2, height: 4 } : undefined);
    if (!footprint) return { state: "blocked", project, reason: "stairs-need-room" };
    const face = network.faces.find((candidate) => (!roomFace || candidate.id === roomFace.id) && assessRegionConstraint(footprint, roomFaceShape(candidate)).state === "inside");
    if (!face) return { state: "blocked", project, reason: "stairs-need-room" };
    const id = identity.createId();
    const sourceLevel = target?.kind === "room" ? project.places.find(({ id }) => id === target.parentId) : target?.kind === "level" ? target : undefined;
    if (!input.transition) return { state: "transition-config-required", project };
    const connectedLevelIds = input.transition.sameLevelRise
      ? [sourceLevel?.id].filter((levelId): levelId is string => Boolean(levelId))
      : [...new Set([sourceLevel?.id, ...(input.transition.connectedLevelIds ?? []), input.transition.targetLevelId].filter((levelId): levelId is string => Boolean(levelId)))];
    if (!input.transition.sameLevelRise && connectedLevelIds.length < 2) return { state: "transition-config-required", project };
    const placed = placeVerticalTransition(document, { id, kind: input.subjectId === "opening.elevator" ? "elevator" : "stairs", footprint, enclosure: roomFaceShape(face), sourceLevelId: sourceLevel?.id, targetLevelId: input.transition.targetLevelId ?? connectedLevelIds.find((levelId) => levelId !== sourceLevel?.id), connectedLevelIds, style: input.transition.style ?? "straight", direction: input.transition.direction ?? 0, sameLevelRise: input.transition.sameLevelRise ?? false }, { levelKinds: new Map(project.places.map(({ id: placeId, kind }) => [placeId, kind])) });
    if (placed.state !== "placed") return { state: "blocked", project, reason: "stairs-need-room" };
    return { state: "applied", project: updateConstruction(project, constructionId, placed.document), selection: { kind: "transition", id, scopeId: constructionId } };
  }
  const kind = input.subjectId.split(".").at(-1) as WallOpening["kind"];
  if (!(["door", "window", "gate", "passage"] as string[]).includes(kind)) return { state: "blocked", project, reason: "unavailable-here" };
  const id = identity.createId();
  const width = kind === "gate" ? 2.4 : kind === "window" ? 1 : 1.2;
  const placed = placeWallOpening(document, { id, kind, point: input.gesture.points[0], width });
  if (placed.state === "no-wall") return { state: "blocked", project, reason: "no-wall" };
  if (placed.state !== "placed") return { state: "blocked", project, reason: "geometry-conflict" };
  if (roomFace && !roomFace.wallIds.includes(placed.opening.wallId)) return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", project: updateConstruction(project, constructionId, placed.document), selection: { kind: "opening", id, scopeId: constructionId } };
}

function applyPoint(project: EditorProject, input: MapGestureCommandInput, targetPlaceId: string, identity: Identity, naming: Naming): MapGestureCommandResult {
  if (input.layerId !== "equipment" && input.layerId !== "sketch") return { state: "blocked", project, reason: "unavailable-here" };
  const id = identity.createId();
  const point = input.gesture.points[0];
  const boundary = project.places.find(({ id: placeId }) => placeId === targetPlaceId)?.boundary;
  if (input.layerId === "equipment" && boundary && !pointInRegion(point, boundary)) return { state: "blocked", project, reason: "outside-outline" };
  const geometry: DrawingElement["geometry"] = input.gesture.instrumentId === "note"
    ? noteBoxFromPoints(input.gesture.points, naming.nameFor(input.subjectId, 1))
    : { kind: "point", at: point };
  const belongsToId = input.layerId === "equipment" ? objectOwnerForPoint(project, targetPlaceId, point) : targetPlaceId;
  if (!belongsToId) return { state: "blocked", project, reason: "geometry-conflict" };
  const next = addDrawingElement(project, belongsToId, { id, name: naming.nameFor(input.subjectId, 1), layerId: input.layerId, subjectId: input.subjectId, geometry, visible: true, locked: false, tags: [], access: [], properties: {} });
  return { state: "applied", project: next, selection: { kind: "element", id } };
}
export function applyMapGesture(project: EditorProject, input: MapGestureCommandInput, identity: Identity, naming: Naming): MapGestureCommandResult {
  const preparedInput = { ...input, gesture: smoothPencilGesture(input.gesture, project.measureSettings.pencilSmoothing) };
  const availability = workLayerAvailability(project, preparedInput.activePlaceId, preparedInput.layerId);
  if (!availability.available) return { state: "blocked", project, reason: "unavailable-here" };
  if (preparedInput.gesture.instrumentId === "erase") {
    const erased = eraseCurrentLayer(project, { activePlaceId: availability.targetPlaceId, layerId: preparedInput.layerId, points: preparedInput.gesture.points, radius: preparedInput.gesture.hitRadius ?? 1.4, boundaryEditing: preparedInput.boundaryEditing }, { createId: identity.createId, createName: identity.createRoomName });
    if (erased.state === "review-required") return { state: "review-required", project, candidateIds: erased.candidateIds };
    if (erased.state === "erased") return { state: "applied", project: erased.project };
    return erased.state === "blocked" ? { state: "blocked", project, reason: "geometry-conflict" } : { state: "nothing", project };
  }
  if (preparedInput.gesture.instrumentId === "point" || preparedInput.gesture.instrumentId === "note") return applyPoint(project, preparedInput, availability.targetPlaceId, identity, naming);
  if (preparedInput.layerId === "roads") return applyRoadGesture(project, preparedInput, identity.createId(), naming.nameFor(preparedInput.subjectId, 1));
  if (isRibbonSubject(preparedInput.layerId, preparedInput.subjectId)) return applyRibbonGesture(project, preparedInput, identity.createId(), naming.nameFor(preparedInput.subjectId, 1));
  if (preparedInput.layerId === "sketch") return applySketchGesture(project, preparedInput, availability.targetPlaceId, identity, naming);
  if (regionLayers.has(preparedInput.layerId)) return applyRegionLayer(project, preparedInput, availability.targetPlaceId, identity, naming);
  if (preparedInput.layerId === "construction" && preparedInput.subjectId.startsWith("platform.")) return applyRegionLayer(project, preparedInput, availability.targetPlaceId, identity, naming);
  if (preparedInput.layerId === "construction" && availability.constructionId) return applyConstruction(project, preparedInput, availability.targetPlaceId, availability.constructionId, identity);
  if (preparedInput.layerId === "openings" && availability.constructionId) return applyOpening(project, preparedInput, availability.targetPlaceId, availability.constructionId, identity);
  return { state: "blocked", project, reason: "unavailable-here" };
}
