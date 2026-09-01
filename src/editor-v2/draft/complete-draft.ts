import { addConstructionSurface, addElement, createBuildingWithDefaultLevel, createPlace } from "../model/hierarchy-operations";
import type { ConstructionSurfaceKind, EditorProject, RegionShape } from "../model/project-model";
import { assessRegionConstraint, regionArea } from "../geometry/region-constraints";
import { localizeRegion } from "../geometry/region-transform";
import { analyzeDraft, wallsForDraft, type SemanticDraft } from "./semantic-draft";
import { connectedFaceShapes } from "./connected-face-shapes";
import { objectOwnerForRegion } from "../drawing/object-ownership";
import { snapConstructionRegion } from "../drawing/construction-snapping";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { constructionWallsForPlace } from "./construction-context";

type Identity = { createId(): string };
type Naming = { nameFor(subjectId: string, index: number): string; levelName(): string; roomName(index: number): string };

function activeBoundary(project: EditorProject, placeId: string) {
  return project.places.find(({ id }) => id === placeId)?.boundary;
}

function facesAsShapes(draft: SemanticDraft): RegionShape[] {
  return connectedFaceShapes(analyzeDraft(draft).faces);
}

function surfaceShapes(project: EditorProject, draft: SemanticDraft) {
  const own = facesAsShapes(draft); if (own.length || !draft.subjectId.startsWith("platform.")) return own;
  const draftWalls = wallsForDraft(draft); const draftIds = new Set(draftWalls.map(({ id }) => id));
  const faces = buildWallNetwork([...constructionWallsForPlace(project, draft.belongsToId), ...draftWalls]).faces
    .filter((face) => face.wallIds.some((id) => draftIds.has(id)));
  // A partial U/three-sided outline can border both the intended platform and
  // the much larger complement of the floor.  Use the smallest supported face
  // as the unambiguous inference and create one surface, never both sides.
  const candidates = faces
    .flatMap((face) => connectedFaceShapes([face]))
    .toSorted((first, second) => regionArea(first) - regionArea(second));
  return candidates.slice(0, 1);
}

function constrainedShapes(project: EditorProject, draft: Pick<SemanticDraft, "layerId" | "belongsToId">, shapes: RegionShape[], acceptClip: boolean) {
  if (draft.layerId !== "buildings" && draft.layerId !== "equipment") return { state: "ready" as const, shapes };
  const boundary = activeBoundary(project, draft.belongsToId);
  const assessments = shapes.map((shape) => assessRegionConstraint(shape, boundary));
  if (assessments.some(({ state }) => state === "outside")) return { state: "outside" as const };
  if (assessments.some(({ state }) => state === "clip-available") && !acceptClip) {
    return { state: "clip-review" as const, shapes: assessments.flatMap((assessment) => assessment.state === "clip-available" ? assessment.shapes : assessment.state === "inside" ? [assessment.shape] : []) };
  }
  return { state: "ready" as const, shapes: assessments.flatMap((assessment) => assessment.state === "clip-available" ? assessment.shapes : assessment.state === "inside" ? [assessment.shape] : []) };
}

export function completeSemanticDraft(project: EditorProject, draft: SemanticDraft, identity: Identity, naming: Naming, acceptClip = false) {
  if (!["buildings", "boundaries", "terrain", "equipment", "construction"].includes(draft.layerId) || draft.layerId === "construction" && !draft.subjectId.startsWith("platform.")) return { state: "unsupported" as const, project };
  const shapes = surfaceShapes(project, draft); if (!shapes.length) return { state: "incomplete" as const, project };
  return completeSemanticShapes(project, draft, shapes, identity, naming, acceptClip);
}

export function completeSemanticShapes(project: EditorProject, draft: Pick<SemanticDraft, "layerId" | "subjectId" | "belongsToId">, shapes: RegionShape[], identity: Identity, naming: Naming, acceptClip = false) {
  if (!["buildings", "boundaries", "terrain", "equipment", "construction"].includes(draft.layerId) || draft.layerId === "construction" && !draft.subjectId.startsWith("platform.")) return { state: "unsupported" as const, project };
  const constrained = constrainedShapes(project, draft, shapes, acceptClip);
  if (constrained.state !== "ready") return { ...constrained, project };
  if (draft.layerId === "equipment" && constrained.shapes.some((shape) => !objectOwnerForRegion(project, draft.belongsToId, shape))) return { state: "outside" as const, project };
  let next = project; const createdIds: string[] = [];
  constrained.shapes.forEach((shape, index) => {
    const id = identity.createId(); createdIds.push(id); const name = naming.nameFor(draft.subjectId, index + 1);
    if (draft.layerId === "buildings") {
      const localized = localizeRegion(shape);
      next = createBuildingWithDefaultLevel(next, { id, levelId: identity.createId(), constructionId: identity.createId(), parentId: draft.belongsToId, name, levelName: naming.levelName(), boundary: localized.boundary, transform: localized.transform, roomName: naming.roomName }, identity);
      next = { ...next, places: next.places.map((place) => place.id === id ? { ...place, properties: { ...place.properties, subjectId: draft.subjectId } } : place) };
    } else if (draft.layerId === "boundaries") {
      const localized = localizeRegion(shape);
      next = createPlace(next, { id, parentId: draft.belongsToId, name, kind: "location", boundary: localized.boundary, transform: localized.transform });
    } else if (draft.layerId === "terrain" || draft.layerId === "equipment") {
      const belongsToId = draft.layerId === "equipment" ? objectOwnerForRegion(next, draft.belongsToId, shape)! : draft.belongsToId;
      next = addElement(next, { id, name, layerId: draft.layerId, subjectId: draft.subjectId, geometry: { kind: "region", shape }, visible: true, locked: false, tags: [], access: [], properties: {} }, belongsToId);
    } else if (draft.layerId === "construction") {
      const kind = (draft.subjectId.split(".").at(-1) ?? "custom") as ConstructionSurfaceKind;
      const attachment = (["porch", "terrace", "balcony"] as ConstructionSurfaceKind[]).includes(kind) ? "attached" as const : "free" as const;
      const surfaceShape = attachment === "attached" ? snapConstructionRegion(shape, constructionWallsForPlace(next, draft.belongsToId)) : shape;
      next = addConstructionSurface(next, { id, name, kind, shape: surfaceShape, attachment, elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, draft.belongsToId);
    }
  });
  return { state: "created" as const, project: next, createdIds };
}

export function keepDraftAsSketch(project: EditorProject, draft: SemanticDraft, identity: Identity, nameForStroke: (index: number) => string) {
  let next = project; const createdIds: string[] = [];
  draft.strokes.forEach((stroke, index) => {
    const id = identity.createId(); createdIds.push(id);
    next = addElement(next, { id, name: nameForStroke(index + 1), layerId: "sketch", subjectId: "sketch.stroke", geometry: { kind: "path", points: stroke.points, closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }, draft.belongsToId);
  });
  return { project: next, createdIds };
}
