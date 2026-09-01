import BufferOp from "jsts/org/locationtech/jts/operation/buffer/BufferOp.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import { relativePlaceMatrix, transformRegion } from "../geometry/affine-transform";
import { regionGeoJson, regionShapesFromGeoJson } from "../geometry/region-constraints";
import type { EditorProject, RegionShape } from "../model/project-model";

function rootOf(project: EditorProject, id: string): string {
  const visited = new Set<string>(); let current = project.places.find((place) => place.id === id);
  while (current?.parentId && !visited.has(current.id)) { visited.add(current.id); current = project.places.find((place) => place.id === current!.parentId); }
  return current?.id ?? id;
}
export function roadObstacles(project: EditorProject, ownerId: string): RegionShape[] {
  const root = rootOf(project, ownerId);
  return project.places.filter((place) => place.kind === "building" && place.boundary && rootOf(project, place.id) === root
    && place.properties.subjectId !== "building.bridge" && place.properties.semanticType !== "bridge")
    .map((place) => transformRegion(relativePlaceMatrix(project, ownerId, place.id), place.boundary!));
}
export function expandRoadObstacle(shape: RegionShape, distance: number): RegionShape {
  const reader = new GeoJSONReader(new GeometryFactory()); const writer = new GeoJSONWriter();
  return regionShapesFromGeoJson(writer.write(BufferOp.bufferOp(reader.read(regionGeoJson(shape)), distance, 2)) as ReturnType<typeof regionGeoJson>)[0] ?? shape;
}
