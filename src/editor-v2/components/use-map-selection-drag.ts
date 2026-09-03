"use client";
import { useRef, useState } from "react";
import type { KernelPoint } from "../geometry/geometry-types";
import type { MapSelection } from "./map-sheet-types";

const dragThresholdPixels = 6;
type PointerSample = { pointerId: number; pointerType: string; buttons: number; clientX: number; clientY: number };
type DragState = { selection: MapSelection; start: KernelPoint; clientStart: KernelPoint; activated: boolean; pointerId: number };
export type SelectionMovePreview = { selection: MapSelection; delta: KernelPoint };

/** Keeps a click distinct from a drag at every zoom and abandons stale pointer capture. */
export function useMapSelectionDrag() {
  const current = useRef<DragState | undefined>(undefined);
  const [preview, setPreview] = useState<SelectionMovePreview>();

  function begin(selection: MapSelection, start: KernelPoint, event: PointerSample) {
    current.current = { selection, start, clientStart: { x: event.clientX, y: event.clientY }, activated: false, pointerId: event.pointerId };
  }

  function move(event: PointerSample, point: KernelPoint) {
    const draft = current.current;
    if (!draft || draft.pointerId !== event.pointerId) return false;
    if ((event.pointerType === "mouse" || event.pointerType === "pen") && event.buttons === 0) { cancel(event.pointerId); return true; }
    if (!draft.activated && screenDistance(draft, event) < dragThresholdPixels) return true;
    draft.activated = true;
    setPreview({ selection: draft.selection, delta: { x: point.x - draft.start.x, y: point.y - draft.start.y } });
    return true;
  }

  function finish(event: PointerSample, end: KernelPoint) {
    const draft = current.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    current.current = undefined; setPreview(undefined);
    if (!draft.activated && screenDistance(draft, event) < dragThresholdPixels) return { handled: true as const };
    return { handled: true as const, selection: draft.selection, delta: { x: end.x - draft.start.x, y: end.y - draft.start.y } };
  }

  function cancel(pointerId?: number) {
    if (!current.current || pointerId !== undefined && current.current.pointerId !== pointerId) return false;
    current.current = undefined; setPreview(undefined); return true;
  }

  return { preview, begin, move, finish, cancel, reset: () => cancel(), isActive: () => Boolean(current.current) };
}

function screenDistance(draft: DragState, event: Pick<PointerSample, "clientX" | "clientY">) {
  return Math.hypot(event.clientX - draft.clientStart.x, event.clientY - draft.clientStart.y);
}
