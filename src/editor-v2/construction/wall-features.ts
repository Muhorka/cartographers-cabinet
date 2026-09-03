import type { KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";
import type { ConstructionDocument } from "./construction-document";
import { assessRegionConstraint, isValidRegionShape, shapePoints, shapePolygons } from "../geometry/region-constraints";
import { roomFaceShape } from "../geometry/room-face-shape";
import { constructionNetwork } from "./construction-network";

export type WallOpening = {
  id: string;
  kind: "door" | "window" | "gate" | "passage";
  wallId: string;
  position: number;
  width: number;
  visible?: boolean;
  locked?: boolean;
};

export type VerticalTransition = {
  id: string;
  kind: "stairs" | "elevator";
  footprint: RegionShape;
  sourceLevelId?: string;
  targetLevelId?: string;
  connectedLevelIds?: string[];
  style?: "straight" | "l" | "u" | "spiral" | "curved";
  direction?: number;
  sameLevelRise?: boolean;
  visible?: boolean;
  locked?: boolean;
};

type VerticalTransitionIssue = {
  code: "invalid-footprint" | "outside-room" | "overlap" | "invalid-level-reference" | "invalid-same-level";
  transitionId: string;
  relatedTransitionId?: string;
  levelId?: string;
  message: string;
};

export type VerticalTransitionValidationOptions = {
  /** The project-level ids and kinds, when the project context is available. */
  levelIds?: ReadonlySet<string>;
  levelKinds?: ReadonlyMap<string, string>;
};

function finitePoint(point: KernelPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function validTransitionFootprint(footprint: RegionShape) {
  try {
    if (footprint.kind === "rectangle" && (footprint.width <= 0 || footprint.height <= 0)) return false;
    if (footprint.kind === "circle" && footprint.radius <= 0) return false;
    if (footprint.kind === "ellipse" && (footprint.rx <= 0 || footprint.ry <= 0)) return false;
    const polygons = shapePolygons(footprint);
    if (!polygons.length || polygons.some(({ outer, holes }) => outer.length < 3 || holes.some((hole) => hole.length < 3) || !outer.every(finitePoint) || holes.some((hole) => !hole.every(finitePoint)))) return false;
    return isValidRegionShape(footprint) && shapePoints(footprint).every(finitePoint);
  } catch {
    return false;
  }
}

function transitionLevelIds(transition: VerticalTransition) {
  return [transition.sourceLevelId, transition.targetLevelId, ...(transition.connectedLevelIds ?? [])].filter((id): id is string => Boolean(id));
}

/**
 * The single construction-level integrity check for persisted vertical
 * transitions.  It deliberately skips containment when a legacy document has
 * neither a room face nor an enclosure: there is no boundary to validate in
 * that representation.  Once either exists, every footprint must fit it.
 */
export function validateVerticalTransitions(document: ConstructionDocument, options: VerticalTransitionValidationOptions = {}) {
  const issues: VerticalTransitionIssue[] = [];
  let faces: ReturnType<typeof constructionNetwork>["faces"] = [];
  try { faces = constructionNetwork(document.walls, document.enclosure).faces; } catch { /* the construction validator reports the network separately */ }
  const hasContainment = faces.length > 0 || Boolean(document.enclosure);
  const containingFace = (footprint: RegionShape) => faces.find((face) => assessRegionConstraint(footprint, roomFaceShape(face)).state === "inside");
  const enclosed = (footprint: RegionShape) => faces.length ? Boolean(containingFace(footprint)) : Boolean(document.enclosure && assessRegionConstraint(footprint, document.enclosure).state === "inside");

  for (const transition of document.transitions) {
    if (!validTransitionFootprint(transition.footprint)) {
      issues.push({ code: "invalid-footprint", transitionId: transition.id, message: `Invalid vertical transition footprint: ${transition.id}` });
      continue;
    }
    if (hasContainment && !enclosed(transition.footprint)) issues.push({ code: "outside-room", transitionId: transition.id, message: `Vertical transition is outside a room face or enclosure: ${transition.id}` });
    const referenced = transitionLevelIds(transition);
    if (options.levelIds || options.levelKinds) for (const levelId of referenced) {
      const kind = options.levelKinds?.get(levelId);
      const known = options.levelKinds ? options.levelKinds.has(levelId) : options.levelIds?.has(levelId);
      if (!known) issues.push({ code: "invalid-level-reference", transitionId: transition.id, levelId, message: `Vertical connection references a missing level: ${levelId}` });
      else if (kind && kind !== "level") issues.push({ code: "invalid-level-reference", transitionId: transition.id, levelId, message: `Vertical connection references a place that is not a level: ${levelId} (${kind})` });
    }
    if (new Set(transition.connectedLevelIds ?? []).size !== (transition.connectedLevelIds ?? []).length) issues.push({ code: "invalid-level-reference", transitionId: transition.id, message: `Vertical connection repeats a connected level: ${transition.id}` });
    if (transition.sameLevelRise && transition.sourceLevelId) {
      const other = referenced.find((levelId) => levelId !== transition.sourceLevelId);
      if (other) issues.push({ code: "invalid-same-level", transitionId: transition.id, levelId: other, message: `Same-level rise references another level: ${transition.id}` });
    }
  }
  for (let first = 0; first < document.transitions.length; first += 1) for (let second = first + 1; second < document.transitions.length; second += 1) {
    const left = document.transitions[first]!; const right = document.transitions[second]!;
    if (validTransitionFootprint(left.footprint) && validTransitionFootprint(right.footprint) && assessRegionConstraint(left.footprint, right.footprint).state !== "outside") issues.push({ code: "overlap", transitionId: left.id, relatedTransitionId: right.id, message: `Vertical transitions overlap: ${left.id} and ${right.id}` });
  }
  return issues;
}

export function findTransitionRoomFace(document: ConstructionDocument, footprint: RegionShape) {
  return constructionNetwork(document.walls, document.enclosure).faces.find((face) => assessRegionConstraint(footprint, roomFaceShape(face)).state === "inside");
}

export function transitionsFitRooms(document: ConstructionDocument) {
  return validateVerticalTransitions(document).length === 0;
}

type Projection = { wallId: string; position: number; distance: number; wallLength: number };

function projection(point: KernelPoint, wall: ConstructionDocument["walls"][number]): Projection {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const lengthSquared = dx * dx + dy * dy;
  const position = lengthSquared ? Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSquared)) : 0;
  const nearest = { x: wall.start.x + dx * position, y: wall.start.y + dy * position };
  return { wallId: wall.id, position, distance: Math.hypot(point.x - nearest.x, point.y - nearest.y), wallLength: Math.sqrt(lengthSquared) };
}

function nearestWall(document: ConstructionDocument, point: KernelPoint, tolerance: number) {
  const nearest = document.walls.map((wall) => projection(point, wall)).toSorted((first, second) => first.distance - second.distance)[0];
  return nearest?.distance <= tolerance ? nearest : undefined;
}

function validSpan(document: ConstructionDocument, opening: WallOpening, ignoreId?: string) {
  const wall = document.walls.find(({ id }) => id === opening.wallId); if (!wall || opening.width <= 0) return false;
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y); const half = opening.width / length / 2;
  if (opening.position - half < 0 || opening.position + half > 1) return false;
  return document.openings.filter(({ wallId, id }) => wallId === opening.wallId && id !== ignoreId).every((other) => {
    const otherHalf = other.width / length / 2;
    return opening.position + half <= other.position - otherHalf || opening.position - half >= other.position + otherHalf;
  });
}

function withRevision(document: ConstructionDocument, patch: Partial<Pick<ConstructionDocument, "openings" | "transitions">>) {
  return { ...document, ...patch, revision: document.revision + 1 };
}

export function placeWallOpening(document: ConstructionDocument, input: { id: string; kind: WallOpening["kind"]; point: KernelPoint; width: number; tolerance?: number }) {
  const target = nearestWall(document, input.point, input.tolerance ?? 2);
  if (!target) return { state: "no-wall" as const, document };
  const opening: WallOpening = { id: input.id, kind: input.kind, wallId: target.wallId, position: target.position, width: input.width };
  if (!validSpan(document, opening)) return { state: "blocked" as const, document };
  return { state: "placed" as const, document: withRevision(document, { openings: [...document.openings, opening] }), opening };
}

export function moveWallOpening(document: ConstructionDocument, id: string, point: KernelPoint, tolerance = 2) {
  const current = document.openings.find((opening) => opening.id === id); if (!current) return { state: "not-found" as const, document };
  const target = nearestWall(document, point, tolerance); if (!target) return { state: "no-wall" as const, document };
  const opening = { ...current, wallId: target.wallId, position: target.position };
  if (!validSpan(document, opening, id)) return { state: "blocked" as const, document };
  return { state: "moved" as const, document: withRevision(document, { openings: document.openings.map((item) => item.id === id ? opening : item) }), opening };
}

export function resizeWallOpening(document: ConstructionDocument, id: string, width: number) {
  const current = document.openings.find((opening) => opening.id === id); if (!current) return { state: "not-found" as const, document };
  const opening = { ...current, width }; if (!validSpan(document, opening, id)) return { state: "blocked" as const, document };
  return { state: "resized" as const, document: withRevision(document, { openings: document.openings.map((item) => item.id === id ? opening : item) }), opening };
}

export function deleteWallOpening(document: ConstructionDocument, id: string) {
  if (!document.openings.some((opening) => opening.id === id)) return { state: "not-found" as const, document };
  return { state: "deleted" as const, document: withRevision(document, { openings: document.openings.filter((opening) => opening.id !== id) }) };
}

export function placeVerticalTransition(document: ConstructionDocument, input: { id: string; kind?: VerticalTransition["kind"]; footprint: RegionShape; enclosure: RegionShape; sourceLevelId?: string; targetLevelId?: string; connectedLevelIds?: string[]; style?: VerticalTransition["style"]; direction?: number; sameLevelRise?: boolean }, validationOptions: VerticalTransitionValidationOptions = {}) {
  if (assessRegionConstraint(input.footprint, input.enclosure).state !== "inside") {
    return { state: "outside-room" as const, document };
  }
  const transition: VerticalTransition = { id: input.id, kind: input.kind ?? "stairs", footprint: input.footprint, ...(input.sourceLevelId ? { sourceLevelId: input.sourceLevelId } : {}), ...(input.targetLevelId ? { targetLevelId: input.targetLevelId } : {}), ...(input.connectedLevelIds?.length ? { connectedLevelIds: [...new Set(input.connectedLevelIds)] } : {}), ...(input.style ? { style: input.style } : {}), ...(input.direction !== undefined ? { direction: input.direction } : {}), ...(input.sameLevelRise !== undefined ? { sameLevelRise: input.sameLevelRise } : {}) };
  const candidate = withRevision(document, { transitions: [...document.transitions, transition] });
  if (validateVerticalTransitions(candidate, validationOptions).some(({ code }) => code === "invalid-footprint" || code === "overlap" || code === "invalid-level-reference" || code === "invalid-same-level")) return { state: "blocked" as const, document };
  return { state: "placed" as const, document: candidate, transition };
}

export function updateVerticalTransition(document: ConstructionDocument, id: string, details: Partial<Pick<VerticalTransition, "kind" | "sourceLevelId" | "targetLevelId" | "connectedLevelIds" | "style" | "direction" | "sameLevelRise">>, validationOptions: VerticalTransitionValidationOptions = {}) {
  const current = document.transitions.find((transition) => transition.id === id); if (!current) return { state: "not-found" as const, document };
  const transition = { ...current, ...details, connectedLevelIds: details.connectedLevelIds ? [...new Set(details.connectedLevelIds)] : current.connectedLevelIds };
  const candidateDocument = withRevision(document, { transitions: document.transitions.map((candidate) => candidate.id === id ? transition : candidate) });
  const issues = validateVerticalTransitions(candidateDocument, validationOptions);
  if (issues.some(({ code }) => code === "invalid-footprint" || code === "outside-room" || code === "overlap" || code === "invalid-level-reference" || code === "invalid-same-level")) return { state: "blocked" as const, document, reason: issues.some(({ code }) => code === "outside-room") ? "outside-room" as const : "collision" as const };
  return { state: "updated" as const, document: candidateDocument, transition };
}

export function deleteVerticalTransition(document: ConstructionDocument, id: string) {
  if (!document.transitions.some((transition) => transition.id === id)) return { state: "not-found" as const, document };
  return { state: "deleted" as const, document: withRevision(document, { transitions: document.transitions.filter((transition) => transition.id !== id) }) };
}

export function wallFeatureIssues(document: ConstructionDocument) {
  return document.openings.flatMap((opening) => validSpan(document, opening, opening.id) ? [] : [`invalid-opening:${opening.id}`]);
}
