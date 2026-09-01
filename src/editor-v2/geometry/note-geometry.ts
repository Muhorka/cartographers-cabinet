import type { DrawingElement } from "../model/project-model";
import type { KernelPoint } from "./geometry-types";

export type NoteGeometry = Extract<DrawingElement["geometry"], { kind: "note" }>;

export function noteDimensions(note: NoteGeometry) {
  const longestLine = Math.max(...note.text.split(/\r?\n/).map((line) => line.length), 1);
  return { width: note.width ?? Math.max(18, Math.min(90, longestLine * 5.5)), height: note.height ?? Math.max(8, note.text.split(/\r?\n/).length * 4.5) };
}

export function noteWorldPoint(note: NoteGeometry, local: KernelPoint): KernelPoint {
  const radians = (note.rotation ?? 0) * Math.PI / 180;
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return { x: note.at.x + cosine * local.x - sine * local.y, y: note.at.y + sine * local.x + cosine * local.y };
}

export function noteLocalPoint(note: NoteGeometry, world: KernelPoint): KernelPoint {
  const radians = (note.rotation ?? 0) * Math.PI / 180;
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const x = world.x - note.at.x; const y = world.y - note.at.y;
  return { x: cosine * x + sine * y, y: -sine * x + cosine * y };
}

export function noteCorners(note: NoteGeometry): KernelPoint[] {
  const { width, height } = noteDimensions(note);
  return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }].map((point) => noteWorldPoint(note, point));
}
