import type { RoomFace } from "./geometry-types";
import type { RegionShape } from "../model/project-model";

/** One representation for a room on the sheet, in hierarchy and in tools. */
export function roomFaceShape(face: Pick<RoomFace, "outer" | "holes">): RegionShape {
  return face.holes.length ? { kind: "compound", polygons: [{ outer: face.outer, holes: face.holes }] } : { kind: "polygon", points: face.outer };
}
