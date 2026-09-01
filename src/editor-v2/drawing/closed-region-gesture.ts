import { completeSemanticShapes } from "../draft/complete-draft";
import { regionArea } from "../geometry/region-constraints";
import type { EditorProject, RegionShape } from "../model/project-model";
import type { MapGestureCommandInput, MapGestureCommandResult } from "./map-gesture-command";
import type { Identity, Naming } from "./map-gesture-command-types";

/** Complete an already closed region without applying wall-junction healing to its sampled boundary. */
export function applyClosedRegionGesture(project: EditorProject, input: MapGestureCommandInput, ownerId: string, shape: RegionShape, identity: Identity, naming: Naming): MapGestureCommandResult {
  if (!(regionArea(shape) > 0)) return { state: "blocked", project, reason: "geometry-conflict" };
  const completed = completeSemanticShapes(project, { layerId: input.layerId, subjectId: input.subjectId, belongsToId: ownerId }, [shape], identity, {
    nameFor: naming.nameFor, levelName: naming.levelName, roomName: identity.createRoomName,
  }, input.acceptClip);
  if (completed.state === "clip-review") return { state: "clip-review", project, pendingDraft: input.pendingDraft };
  if (completed.state === "outside") return { state: "blocked", project, reason: "outside-outline" };
  if (completed.state !== "created") return { state: "blocked", project, reason: "geometry-conflict" };
  const id = completed.createdIds[0];
  const kind = completed.project.places.some((place) => place.id === id) ? "place"
    : completed.project.surfaces.some((surface) => surface.id === id) ? "surface" : "element";
  return { state: "applied", project: completed.project, selection: id ? { kind, id } : undefined, pendingDraft: input.pendingDraft };
}
