import type { EditorProject } from "./project-model";
import { isRibbonSubject } from "../geometry/ribbon-geometry";
import { validateVerticalTransitions } from "../construction/wall-features";

export type ProjectIntegrityIssue = {
  message: string;
  path: (string | number)[];
};

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates];
}

function duplicateIndices(values: readonly string[]) {
  const firstIndex = new Map<string, number>();
  return values.flatMap((value, index) => {
    const first = firstIndex.get(value);
    if (first === undefined) {
      firstIndex.set(value, index);
      return [];
    }
    return [{ value, first, index }];
  });
}

/** Checks cross-record invariants without cloning or reparsing the project. */
export function projectIntegrityIssues(project: EditorProject): ProjectIntegrityIssue[] {
  const issues: ProjectIntegrityIssue[] = [];
  const add = (message: string, path: (string | number)[]) => issues.push({ message, path });
  const placeIds = new Set(project.places.map(({ id }) => id));
  const placesById = new Map(project.places.map((candidate) => [candidate.id, candidate]));
  const placeIndexById = new Map(project.places.map((candidate, index) => [candidate.id, index]));
  const constructionIds = new Set(project.constructions.map(({ id }) => id));
  const levelIds = new Set(project.places.filter(({ kind }) => kind === "level").map(({ id }) => id));
  const placeKinds = new Map(project.places.map(({ id, kind }) => [id, kind]));

  for (const id of duplicateValues(project.places.map(({ id }) => id))) add(`Duplicate place id: ${id}`, ["places"]);
  for (const id of duplicateValues(project.elements.map(({ id }) => id))) add(`Duplicate element id: ${id}`, ["elements"]);
  for (const id of duplicateValues(project.surfaces.map(({ id }) => id))) add(`Duplicate construction surface id: ${id}`, ["surfaces"]);
  for (const id of duplicateValues(project.constructions.map(({ id }) => id))) add(`Duplicate construction id: ${id}`, ["constructions"]);
  for (const id of duplicateValues((project.roadJunctions ?? []).map(({ id }) => id))) add(`Duplicate road junction id: ${id}`, ["roadJunctions"]);
  // Walls, openings and transitions are scoped by construction. A room is
  // different: its id is also the global PlaceNode id used for navigation.
  for (const id of duplicateValues(project.constructions.flatMap(({ rooms }) => rooms.map(({ id }) => id)))) add(`Duplicate room id across constructions: ${id}`, ["constructions"]);

  project.places.forEach((candidate, index) => {
    if (candidate.parentId && !placeIds.has(candidate.parentId)) add(`Missing parent place: ${candidate.parentId}`, ["places", index, "parentId"]);
    if (candidate.constructionId && !constructionIds.has(candidate.constructionId)) add(`Missing construction: ${candidate.constructionId}`, ["places", index, "constructionId"]);
  });

  // A completed branch is never walked again, so hierarchy validation remains linear.
  const completed = new Set<string>();
  for (const candidate of project.places) {
    if (completed.has(candidate.id)) continue;
    const chain: string[] = [];
    const position = new Map<string, number>();
    let current: typeof candidate | undefined = candidate;
    while (current && !completed.has(current.id)) {
      const repeatedAt = position.get(current.id);
      if (repeatedAt !== undefined) {
        for (const id of chain.slice(repeatedAt)) add(`Hierarchy cycle at place: ${id}`, ["places", placeIndexById.get(id) ?? 0, "parentId"]);
        break;
      }
      position.set(current.id, chain.length);
      chain.push(current.id);
      current = current.parentId ? placesById.get(current.parentId) : undefined;
    }
    chain.forEach((id) => completed.add(id));
  }

  project.elements.forEach((element, index) => {
    if (!placeIds.has(element.belongsToId)) add(`Missing element owner: ${element.belongsToId}`, ["elements", index, "belongsToId"]);
    if (isRibbonSubject(element.layerId, element.subjectId) && (element.geometry.kind === "path" || element.geometry.kind === "bezier")) {
      const anchors = element.geometry.kind === "path" ? element.geometry.points : element.geometry.nodes.map(({ anchor }) => anchor);
      const first = anchors[0];
      if (!first || !anchors.slice(1).some(({ x, y }) => x !== first.x || y !== first.y)) add(`Ribbon needs at least two distinct points: ${element.id}`, ["elements", index, "geometry"]);
    }
  });
  project.surfaces.forEach((surface, index) => {
    if (!placeIds.has(surface.belongsToId)) add(`Missing construction surface owner: ${surface.belongsToId}`, ["surfaces", index, "belongsToId"]);
  });

  const roadsById = new Map(project.elements.filter(({ layerId }) => layerId === "roads").map((road) => [road.id, road]));
  (project.roadJunctions ?? []).forEach((junction, index) => {
    const path = ["roadJunctions", index] as (string | number)[];
    if (!placeIds.has(junction.belongsToId)) add(`Missing road junction owner: ${junction.belongsToId}`, [...path, "belongsToId"]);
    if (junction.roadIds.length !== 2) {
      add(`Road junction must reference exactly two roads: ${junction.id}`, [...path, "roadIds"]);
      return;
    }
    const [firstId, secondId] = junction.roadIds;
    if (firstId === secondId) {
      add(`Road junction must reference two distinct roads: ${junction.id}`, [...path, "roadIds"]);
      return;
    }
    const first = roadsById.get(firstId!);
    const second = roadsById.get(secondId!);
    if (!first) add(`Road junction references a missing road: ${firstId}`, [...path, "roadIds"]);
    if (!second) add(`Road junction references a missing road: ${secondId}`, [...path, "roadIds"]);
    if (first && second && (first.belongsToId !== second.belongsToId || junction.belongsToId !== first.belongsToId)) {
      add(`Road junction owner does not match its roads: ${junction.id}`, [...path, "belongsToId"]);
    }
  });

  project.constructions.forEach((document, index) => {
    const wallIds = new Set(document.walls.map(({ id }) => id));
    for (const id of duplicateValues(document.walls.map(({ id }) => id))) add(`Duplicate wall id: ${id}`, ["constructions", index, "walls"]);
    for (const duplicate of duplicateIndices(document.rooms.map(({ id }) => id))) add(`Duplicate room id in construction ${document.id}: ${duplicate.value} (also at index ${duplicate.first}).`, ["constructions", index, "rooms", duplicate.index, "id"]);
    for (const duplicate of duplicateIndices(document.openings.map(({ id }) => id))) add(`Duplicate opening id in construction ${document.id}: ${duplicate.value} (also at index ${duplicate.first}).`, ["constructions", index, "openings", duplicate.index, "id"]);
    for (const duplicate of duplicateIndices(document.transitions.map(({ id }) => id))) add(`Duplicate transition id in construction ${document.id}: ${duplicate.value} (also at index ${duplicate.first}).`, ["constructions", index, "transitions", duplicate.index, "id"]);
    for (const opening of document.openings) if (!wallIds.has(opening.wallId)) add(`Opening references a missing wall: ${opening.wallId}`, ["constructions", index, "openings"]);
    const transitionIndex = new Map(document.transitions.map((transition, transitionIndex) => [transition.id, transitionIndex]));
    for (const issue of validateVerticalTransitions(document, { levelIds, levelKinds: placeKinds })) {
      const transitionPath = transitionIndex.get(issue.transitionId);
      add(issue.message, ["constructions", index, "transitions", ...(transitionPath === undefined ? [] : [transitionPath])]);
    }
  });

  return issues;
}

export function assertProjectIntegrity(project: EditorProject) {
  const issue = projectIntegrityIssues(project)[0];
  if (issue) throw new Error(issue.message);
}
