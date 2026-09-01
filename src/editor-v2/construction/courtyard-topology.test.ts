import { describe, expect, it } from "vitest";
import { constructionNetwork, createConstructionDocument, repairConstructionDocument } from "./construction-document";
import type { RegionShape } from "../model/project-model";
import { shapePolygons } from "../geometry/region-constraints";
import { normalizePoint } from "../geometry/geometry-normalization";
import { emptyProject } from "../model/project-model";
import { createIndependentLevel } from "../model/hierarchy-operations";
import { repairProjectConstructions } from "../model/construction-repair";

const identity = () => { let id = 0; return { createId: () => `object-${++id}`, createName: (index: number) => `Room ${index}` }; };
const enclosure: RegionShape = { kind: "compound", polygons: [{
  outer: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 25 }, { x: 0, y: 25 }],
  holes: [[{ x: 9.123456789, y: 8.234567891 }, { x: 18.246813579, y: 7.135792468 }, { x: 18.753159246, y: 13.876543219 }, { x: 7.246813579, y: 15.135792468 }]],
}] };

describe("courtyard topology across persistence", () => {
  it("never makes a room from microscopic overlap at a rounded void boundary", () => {
    const walls = shapePolygons(enclosure).flatMap(({ outer, holes }) => [outer, ...holes]).flatMap((ring, ringId) => ring.map((start, index) => ({ id: `${ringId}-${index}`, start: normalizePoint(start), end: normalizePoint(ring[(index + 1) % ring.length]), role: "boundary" as const, thickness: .3 })));
    const document = createConstructionDocument("plan", walls, identity(), enclosure);
    expect(document.rooms).toHaveLength(1);
    expect(constructionNetwork(document.walls, enclosure).faces[0].holes).toHaveLength(1);
    expect(repairConstructionDocument(document, identity()).rooms).toHaveLength(1);
  });

  it("keeps the hole in navigable rooms through repair and serialization", () => {
    const ids = identity();
    const project = createIndependentLevel(emptyProject("test", "Test"), { id: "level", constructionId: "construction", name: "Level", boundary: enclosure }, ids);
    const rooms = project.places.filter(({ kind }) => kind === "room");
    expect(rooms).toHaveLength(1);
    expect(shapePolygons(rooms[0].boundary!)[0].holes).toHaveLength(1);
    const repaired = repairProjectConstructions(JSON.parse(JSON.stringify(project)), ids);
    expect(repaired.places.filter(({ kind }) => kind === "room")).toHaveLength(1);
    expect(shapePolygons(repaired.places.find(({ kind }) => kind === "room")!.boundary!)[0].holes).toHaveLength(1);
  });
});
