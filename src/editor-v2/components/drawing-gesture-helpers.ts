import { regionFromGesture } from "../drawing/gesture-geometry";
import type { RegionShape } from "../model/project-model";
import type { MapGesture, MapGestureDraft } from "./map-sheet-gesture";

export function cutoutShape(gesture: MapGesture): RegionShape | undefined {
  if (gesture.instrumentId === "pen" && (gesture.bezierNodes?.length ?? 0) >= 2) return { kind: "bezier", nodes: gesture.bezierNodes!, closed: true };
  if (gesture.instrumentId === "arc" && (gesture.bezierNodes?.length ?? 0) >= 2) return { kind: "bezier", nodes: gesture.bezierNodes!, closed: true };
  if (gesture.instrumentId === "pencil" && gesture.points.length >= 3) return { kind: "polygon", points: gesture.points };
  return regionFromGesture(gesture.instrumentId, gesture.points);
}

export function closableGesture(draft?: MapGestureDraft) {
  if (draft?.instrumentId === "pen" && (draft.bezierNodes?.length ?? 0) >= 2) return { ...draft, closed: true, hover: undefined, pointerId: undefined };
  if (draft && (draft.instrumentId === "polygon" || draft.instrumentId === "wall-run") && draft.points.length >= 3) return { ...draft, closed: true, hover: undefined, pointerId: undefined };
  return undefined;
}

export function gestureWithoutLastPoint(draft: MapGestureDraft) {
  if (draft.instrumentId === "pen" && draft.bezierNodes?.length) {
    const bezierNodes = draft.bezierNodes.slice(0, -1);
    return bezierNodes.length ? { ...draft, points: bezierNodes.map(({ anchor }) => anchor), bezierNodes, pointerId: undefined, hover: undefined } : undefined;
  }
  const points = draft.points.slice(0, -1);
  return points.length ? { ...draft, points, pointerId: undefined, hover: undefined } : undefined;
}
