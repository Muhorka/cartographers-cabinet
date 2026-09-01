import { addRegionToOutline } from "../drawing/add-to-outline-operation";
import { cutRegionFromSelection } from "../drawing/cutout-operation";
import type { EditorProject } from "../model/project-model";
import type { MapSelection } from "./map-sheet";
import type { MapGesture } from "./map-sheet-gesture";
import { cutoutShape } from "./drawing-gesture-helpers";
import { smoothPencilGesture } from "../geometry/pencil-smoothing";

type Identity = { createId(): string; createRoomName(index: number): string };
type OutlineMode = "add" | "cut";

export function applyOutlineGesture(project: EditorProject, activePlaceId: string, selection: MapSelection | undefined, gesture: MapGesture, identity: Identity, mode: OutlineMode) {
  const shape = cutoutShape(smoothPencilGesture(gesture, project.measureSettings.pencilSmoothing));
  if (!shape || !selection || !(selection.kind === "place" || selection.kind === "element" || selection.kind === "surface")) return { state: "blocked" as const, reason: "unavailable-here" as const };
  const target = { kind: selection.kind, id: selection.id };
  if (mode === "add") {
    const result = addRegionToOutline(project, activePlaceId, target, shape, identity);
    if (result.state === "applied") return { ...result, mode, transactionId: `add-outline:${target.kind}:${target.id}` };
    return { state: "blocked" as const, reason: result.reason === "not-found" || result.reason === "unsupported" ? "unavailable-here" as const : "geometry-conflict" as const };
  }
  const result = cutRegionFromSelection(project, activePlaceId, target, shape, identity);
  if (result.state === "applied") return { ...result, mode, transactionId: `cutout:${target.kind}:${target.id}` };
  return { state: "blocked" as const, reason: result.reason === "outside-target" ? "outside-outline" as const : result.reason === "not-found" || result.reason === "unsupported" ? "unavailable-here" as const : "geometry-conflict" as const };
}
