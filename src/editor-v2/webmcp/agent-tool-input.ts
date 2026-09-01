import type { RegionShape } from "../model/project-model";
import type { AgentObjectRef } from "./agent-command-types";

export function text(input: Record<string, unknown>, key: string) {
  const value = input[key]; if (typeof value !== "string" || !value.trim()) throw new TypeError(`${key} must be a non-empty string`); return value;
}

export function records(input: Record<string, unknown>, key: string) {
  const value = input[key]; if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new TypeError(`${key} must be an array of objects`);
  return value as Record<string, unknown>[];
}

export function refs(input: Record<string, unknown>, key = "refs"): AgentObjectRef[] {
  return records(input, key).map((item) => ({ type: text(item, "type") as AgentObjectRef["type"], id: text(item, "id"), ...(typeof item.scopeId === "string" ? { scopeId: item.scopeId } : {}) }));
}

export function regionShape(value: unknown): RegionShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("shape must be a region object");
  const shape = value as Record<string, unknown>; const kind = text(shape, "kind");
  if (kind === "polygon") return { kind, points: records(shape, "points").map((point) => ({ x: number(point, "x"), y: number(point, "y") })) };
  if (kind === "rectangle") return { kind, x: number(shape, "x"), y: number(shape, "y"), width: number(shape, "width"), height: number(shape, "height") };
  if (kind === "circle") return { kind, cx: number(shape, "cx"), cy: number(shape, "cy"), radius: number(shape, "radius") };
  if (kind === "ellipse") return { kind, cx: number(shape, "cx"), cy: number(shape, "cy"), rx: number(shape, "rx"), ry: number(shape, "ry") };
  if (kind === "bezier") return { kind: "bezier", nodes: records(shape, "nodes").map((node) => ({ anchor: point(node, "anchor"), inHandle: optionalPoint(node, "inHandle"), outHandle: optionalPoint(node, "outHandle") })), closed: true };
  if (kind === "compound") return { kind, polygons: records(shape, "polygons").map((polygon) => ({ outer: records(polygon, "outer").map((candidate) => ({ x: number(candidate, "x"), y: number(candidate, "y") })), holes: Array.isArray(polygon.holes) ? (polygon.holes as unknown[]).map((hole) => { if (!Array.isArray(hole)) throw new TypeError("hole must be an array"); return (hole as unknown[]).map((candidate) => pointValue(candidate)); }) : [] })) };
  throw new TypeError("unsupported region shape");
}

function point(input: Record<string, unknown>, key: string) {
  const value = input[key]; if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${key} must be a point`); return pointValue(value);
}

function optionalPoint(input: Record<string, unknown>, key: string) { return input[key] === undefined ? undefined : point(input, key); }

function pointValue(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("point must be an object"); const candidate = value as Record<string, unknown>; return { x: number(candidate, "x"), y: number(candidate, "y") }; }

function number(input: Record<string, unknown>, key: string) {
  const value = input[key]; if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${key} must be a finite number`); return value;
}
