import type { CanonicalWall, KernelPoint, RoomFace } from "../../geometry/geometry-types";
import { pointInRegion } from "../../geometry/region-constraints";
import { roomFaceShape } from "../../geometry/room-face-shape";

/**
 * Place a route portal inside a face along the wall normal. A centroid-based
 * offset can lose clearance on off-centre doors and on rotated walls.
 */
export function faceAnchor(face: Pick<RoomFace, "outer" | "holes">, point: KernelPoint, wall: CanonicalWall, margin: number) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = Math.max(.05, margin + .05);
  const candidates = [
    { x: point.x - dy / length * offset, y: point.y + dx / length * offset },
    { x: point.x + dy / length * offset, y: point.y - dx / length * offset },
  ];
  return candidates.find((candidate) => pointInRegion(candidate, roomFaceShape(face)));
}
