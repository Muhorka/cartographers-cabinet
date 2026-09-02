import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import { emptyProject } from "../../model/project-model";
import { relevantLevelIds } from "./relevant-levels";

describe("relevant route levels", () => {
  it("keeps the complete transition component and prunes unrelated levels", () => {
    const project = emptyProject("levels", "Levels");
    for (const id of ["ground", "upper", "unrelated"]) {
      let room = 0; const document = createConstructionDocument(`${id}-document`, [], { createId: () => `${id}-room-${room++}`, createName: (index) => `Room ${index}` }); if (id !== "unrelated") document.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 0, y: 0, width: 1, height: 1 }, sourceLevelId: "ground", targetLevelId: "upper", connectedLevelIds: ["ground", "upper"] }];
      project.constructions.push(document); project.places.push({ id, name: id, kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} });
    }
    const result = relevantLevelIds(project, { from: { placeId: "ground", point: { x: 0, y: 0 } }, to: { placeId: "upper", point: { x: 0, y: 0 } } });
    expect([...result].toSorted()).toEqual(["ground", "upper"]);
  });
});
