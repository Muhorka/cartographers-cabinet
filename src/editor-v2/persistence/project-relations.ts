import { z } from "zod";
import type { EditorProject } from "../model/project-model";

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>(); const duplicates = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates];
}

function duplicateIndices(values: readonly string[]) {
  const firstIndex = new Map<string, number>();
  return values.flatMap((value, index) => {
    const first = firstIndex.get(value);
    if (first === undefined) { firstIndex.set(value, index); return []; }
    return [{ value, first, index }];
  });
}

export function validateProjectRelations(project: EditorProject, context: z.RefinementCtx) {
  const placeIds = new Set(project.places.map(({ id }) => id));
  const placesById = new Map(project.places.map((candidate) => [candidate.id, candidate]));
  const constructionIds = new Set(project.constructions.map(({ id }) => id));
  for (const id of duplicateValues(project.places.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate place id: ${id}`, path: ["places"] });
  for (const id of duplicateValues(project.elements.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate element id: ${id}`, path: ["elements"] });
  for (const id of duplicateValues(project.surfaces.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate construction surface id: ${id}`, path: ["surfaces"] });
  for (const id of duplicateValues(project.constructions.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate construction id: ${id}`, path: ["constructions"] });
  for (const [index, candidate] of project.places.entries()) {
    if (candidate.parentId && !placeIds.has(candidate.parentId)) context.addIssue({ code: "custom", message: `Missing parent place: ${candidate.parentId}`, path: ["places", index, "parentId"] });
    if (candidate.constructionId && !constructionIds.has(candidate.constructionId)) context.addIssue({ code: "custom", message: `Missing construction: ${candidate.constructionId}`, path: ["places", index, "constructionId"] });
    const visited = new Set([candidate.id]); let parentId = candidate.parentId;
    while (parentId) {
      if (visited.has(parentId)) { context.addIssue({ code: "custom", message: `Hierarchy cycle at place: ${candidate.id}`, path: ["places", index, "parentId"] }); break; }
      visited.add(parentId); parentId = project.places.find(({ id }) => id === parentId)?.parentId;
    }
  }
  for (const [index, element] of project.elements.entries()) if (!placeIds.has(element.belongsToId)) {
    context.addIssue({ code: "custom", message: `Missing element owner: ${element.belongsToId}`, path: ["elements", index, "belongsToId"] });
  }
  for (const [index, surface] of project.surfaces.entries()) if (!placeIds.has(surface.belongsToId)) {
    context.addIssue({ code: "custom", message: `Missing construction surface owner: ${surface.belongsToId}`, path: ["surfaces", index, "belongsToId"] });
  }
  for (const [index, document] of project.constructions.entries()) {
    const wallIds = new Set(document.walls.map(({ id }) => id));
    for (const id of duplicateValues(document.walls.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate wall id: ${id}`, path: ["constructions", index, "walls"] });
    for (const duplicate of duplicateIndices(document.rooms.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate room id in construction ${document.id}: ${duplicate.value} (also at index ${duplicate.first}).`, path: ["constructions", index, "rooms", duplicate.index, "id"] });
    for (const duplicate of duplicateIndices(document.openings.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate opening id in construction ${document.id}: ${duplicate.value} (also at index ${duplicate.first}).`, path: ["constructions", index, "openings", duplicate.index, "id"] });
    for (const duplicate of duplicateIndices(document.transitions.map(({ id }) => id))) context.addIssue({ code: "custom", message: `Duplicate transition id in construction ${document.id}: ${duplicate.value} (also at index ${duplicate.first}).`, path: ["constructions", index, "transitions", duplicate.index, "id"] });
    for (const openingValue of document.openings) if (!wallIds.has(openingValue.wallId)) context.addIssue({ code: "custom", message: `Opening references a missing wall: ${openingValue.wallId}`, path: ["constructions", index, "openings"] });
    for (const transitionValue of document.transitions) {
      const referenced = [...(transitionValue.sourceLevelId ? [transitionValue.sourceLevelId] : []), ...(transitionValue.targetLevelId ? [transitionValue.targetLevelId] : []), ...(transitionValue.connectedLevelIds ?? [])];
      for (const levelId of referenced) {
        const referencedPlace = placesById.get(levelId);
        if (!referencedPlace) context.addIssue({ code: "custom", message: `Vertical connection references a missing level: ${levelId}`, path: ["constructions", index, "transitions"] });
        else if (referencedPlace.kind !== "level") context.addIssue({ code: "custom", message: `Vertical connection references a place that is not a level: ${levelId} (${referencedPlace.kind})`, path: ["constructions", index, "transitions"] });
      }
    }
  }
}
