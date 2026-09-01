import { pointKey } from "../geometry/geometry-normalization";
import { unionRegionShapes } from "../geometry/region-constraints";
import type { RoomFace } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";

export function connectedFaceShapes(faces: readonly RoomFace[]): RegionShape[] {
  const groups: RoomFace[][] = [];
  for (const face of faces) {
    const keys = new Set(face.outer.map(pointKey));
    const touching = groups.filter((group) => group.some((candidate) => candidate.outer.some((point) => keys.has(pointKey(point)))));
    if (!touching.length) { groups.push([face]); continue; }
    const merged = [face, ...touching.flat()]; touching.forEach((group) => groups.splice(groups.indexOf(group), 1)); groups.push(merged);
  }
  return groups.flatMap((group) => {
    // Keep face holes: flattening every face to its outer ring turns a room
    // with an island/opening into a solid region during draft completion.
    const shape = unionRegionShapes(group.map(({ outer, holes }) => ({ kind: "compound", polygons: [{ outer, holes }] })));
    return shape ? [shape] : [];
  });
}
