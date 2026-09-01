import type { KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";
import type { ConstructionDocument } from "./construction-document";
import { assessRegionConstraint } from "../geometry/region-constraints";

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

export function placeVerticalTransition(document: ConstructionDocument, input: { id: string; kind?: VerticalTransition["kind"]; footprint: RegionShape; enclosure: RegionShape; sourceLevelId?: string; targetLevelId?: string; connectedLevelIds?: string[]; style?: VerticalTransition["style"]; direction?: number; sameLevelRise?: boolean }) {
  if (assessRegionConstraint(input.footprint, input.enclosure).state !== "inside") {
    return { state: "outside-room" as const, document };
  }
  const overlaps = document.transitions.some(({ footprint }) => assessRegionConstraint(input.footprint, footprint).state !== "outside");
  if (overlaps) return { state: "blocked" as const, document };
  const transition: VerticalTransition = { id: input.id, kind: input.kind ?? "stairs", footprint: input.footprint, ...(input.sourceLevelId ? { sourceLevelId: input.sourceLevelId } : {}), ...(input.targetLevelId ? { targetLevelId: input.targetLevelId } : {}), ...(input.connectedLevelIds?.length ? { connectedLevelIds: [...new Set(input.connectedLevelIds)] } : {}), ...(input.style ? { style: input.style } : {}), ...(input.direction !== undefined ? { direction: input.direction } : {}), ...(input.sameLevelRise !== undefined ? { sameLevelRise: input.sameLevelRise } : {}) };
  return { state: "placed" as const, document: withRevision(document, { transitions: [...document.transitions, transition] }), transition };
}

export function updateVerticalTransition(document: ConstructionDocument, id: string, details: Partial<Pick<VerticalTransition, "kind" | "sourceLevelId" | "targetLevelId" | "connectedLevelIds" | "style" | "direction" | "sameLevelRise">>) {
  const current = document.transitions.find((transition) => transition.id === id); if (!current) return { state: "not-found" as const, document };
  const transition = { ...current, ...details, connectedLevelIds: details.connectedLevelIds ? [...new Set(details.connectedLevelIds)] : current.connectedLevelIds };
  return { state: "updated" as const, document: withRevision(document, { transitions: document.transitions.map((candidate) => candidate.id === id ? transition : candidate) }), transition };
}

export function deleteVerticalTransition(document: ConstructionDocument, id: string) {
  if (!document.transitions.some((transition) => transition.id === id)) return { state: "not-found" as const, document };
  return { state: "deleted" as const, document: withRevision(document, { transitions: document.transitions.filter((transition) => transition.id !== id) }) };
}

export function wallFeatureIssues(document: ConstructionDocument) {
  return document.openings.flatMap((opening) => validSpan(document, opening, opening.id) ? [] : [`invalid-opening:${opening.id}`]);
}
