import type { CanonicalWall, RoomFace } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";
import { GEOMETRY_PRECISION, normalizePoint } from "../geometry/geometry-normalization";
import { assessRegionConstraint, regionArea, shapePolygons } from "../geometry/region-constraints";
import { roomFaceShape } from "../geometry/room-face-shape";
import { buildWallNetwork } from "../geometry/wall-network-kernel";

function belongsToEnclosure(face: RoomFace, enclosure: RegionShape) {
  const assessment = assessRegionConstraint(roomFaceShape(face), enclosure);
  if (assessment.state === "inside") return true;
  if (assessment.state === "outside") return false;
  // A room must fit in the floor, not merely touch it. Allow only the narrow
  // numerical strip introduced by rounded vertices, never a courtyard whose
  // intersection with the floor happens to contain such a strip.
  const perimeter = [face.outer, ...face.holes].reduce((total, ring) => total + ring.reduce((sum, p, i) => sum + Math.hypot(p.x - ring[(i + 1) % ring.length].x, p.y - ring[(i + 1) % ring.length].y), 0), 0);
  const tolerance = Math.max(1e-7, perimeter * 2 / GEOMETRY_PRECISION);
  const coveredArea = assessment.shapes.reduce((sum, shape) => sum + regionArea(shape), 0);
  return face.area - coveredArea <= tolerance && coveredArea > tolerance;
}

/** Construction consumers share this enclosure-aware interpretation of faces. */
export function constructionNetwork(walls: CanonicalWall[], enclosure?: RegionShape) {
  const network = buildWallNetwork(walls);
  if (!enclosure) return network;
  const normalized: RegionShape = { kind: "compound", polygons: shapePolygons(enclosure).map(({ outer, holes }) => ({ outer: outer.map(normalizePoint), holes: holes.map((ring) => ring.map(normalizePoint)) })) };
  return { ...network, faces: network.faces.filter((face) => belongsToEnclosure(face, normalized)) };
}
