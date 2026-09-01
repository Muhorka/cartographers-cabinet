import type { EditorProject } from "./project-model";

export function reorderLevel(project: EditorProject, levelId: string, beforeLevelId?: string) {
  const level = project.places.find(({ id }) => id === levelId);
  if (!level || level.kind !== "level" || !level.parentId) throw new Error("The level does not belong to a building");
  const siblings = project.places
    .filter(({ parentId, kind }) => parentId === level.parentId && kind === "level")
    .sort((left, right) => (left.order ?? project.places.indexOf(left)) - (right.order ?? project.places.indexOf(right)));
  const target = beforeLevelId ? siblings.find(({ id }) => id === beforeLevelId) : undefined;
  if (beforeLevelId && (!target || target.parentId !== level.parentId)) throw new Error("Levels can only be reordered inside one building");
  const ordered = siblings.filter(({ id }) => id !== levelId);
  const targetIndex = target ? ordered.findIndex(({ id }) => id === target.id) : ordered.length;
  ordered.splice(Math.max(0, targetIndex), 0, level);
  const orderById = new Map(ordered.map(({ id }, index) => [id, index]));
  return { ...project, places: project.places.map((candidate) => orderById.has(candidate.id) ? { ...candidate, order: orderById.get(candidate.id)! } : candidate) };
}
