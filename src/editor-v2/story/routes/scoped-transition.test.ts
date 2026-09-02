import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject } from "../../model/project-model";
import { findStoryRoutes } from "./planner";
import { relevantLevelIds } from "./relevant-levels";

const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }, role: CanonicalWall["role"] = "boundary"): CanonicalWall => ({ id, start, end, role, thickness: .2 });

function document(id: string) {
  let roomIndex = 0;
  const result = createConstructionDocument(id, [
    wall(`${id}-south`, { x: 0, y: 0 }, { x: 10, y: 0 }),
    wall(`${id}-east`, { x: 10, y: 0 }, { x: 10, y: 10 }),
    wall(`${id}-north`, { x: 10, y: 10 }, { x: 0, y: 10 }),
    wall(`${id}-west`, { x: 0, y: 10 }, { x: 0, y: 0 }),
    wall(`${id}-partition`, { x: 5, y: 0 }, { x: 5, y: 10 }, "partition"),
  ], { createId: () => `${id}-room-${roomIndex++}`, createName: () => `${id} room` });
  result.openings = [{ id: `${id}-door`, kind: "door", wallId: `${id}-partition`, position: .5, width: 1 }];
  return result;
}

function projectWithDuplicateTargetTransition(kind: "stairs" | "elevator") {
  const lowerDocument = document("lower-plan");
  lowerDocument.transitions = [{ id: "shared-stairs", kind: "stairs", footprint: { kind: "rectangle", x: 6, y: 4, width: 1, height: 2 }, sourceLevelId: "lower", targetLevelId: "upper", connectedLevelIds: ["lower", "upper"] }];
  const upperDocument = document("upper-plan");
  // This is a different transition in another construction scope. Its raw id
  // is intentionally reused, but its landing is nowhere near the shared stair.
  upperDocument.transitions = [{ id: "shared-stairs", kind, footprint: { kind: "rectangle", x: 1, y: 1, width: 1, height: 1 }, sourceLevelId: "upper", connectedLevelIds: ["upper"] }];
  const unrelatedDocument = document("unrelated-plan");
  unrelatedDocument.transitions = [{ id: "shared-stairs", kind: "stairs", footprint: { kind: "rectangle", x: 6, y: 4, width: 1, height: 2 }, sourceLevelId: "unrelated", targetLevelId: "unrelated-upper", connectedLevelIds: ["unrelated", "unrelated-upper"] }];
  const unrelatedUpperDocument = document("unrelated-upper-plan");
  const project = emptyProject("scoped-transitions", "Scoped transitions");
  project.places.push(
    { id: "lower", name: "Lower", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: lowerDocument.id, tags: [], access: [], properties: {} },
    { id: "upper", name: "Upper", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: upperDocument.id, tags: [], access: [], properties: {} },
    { id: "unrelated", name: "Unrelated", kind: "level", transform: { x: 100, y: 0, rotation: 0 }, constructionId: unrelatedDocument.id, tags: [], access: [], properties: {} },
    { id: "unrelated-upper", name: "Unrelated upper", kind: "level", transform: { x: 100, y: 0, rotation: 0 }, constructionId: unrelatedUpperDocument.id, tags: [], access: [], properties: {} },
  );
  project.constructions.push(lowerDocument, upperDocument, unrelatedDocument, unrelatedUpperDocument);
  return project;
}

describe("scoped transition routing", () => {
  it("does not expand the relevant vertical component through a raw id reused elsewhere", () => {
    const project = projectWithDuplicateTargetTransition("stairs");
    const relevant = relevantLevelIds(project, { from: { placeId: "lower", point: { x: 2, y: 5 } }, to: { placeId: "upper", point: { x: 8, y: 5 } } });

    expect(relevant).toEqual(new Set(["lower", "upper"]));
  });

  it.each(["stairs", "elevator"] as const)("does not substitute an independent %s landing with the same raw id", (kind) => {
    const result = findStoryRoutes(projectWithDuplicateTargetTransition(kind), {
      from: { placeId: "lower", point: { x: 2, y: 5 } },
      to: { placeId: "upper", point: { x: 8, y: 5 } },
    });

    expect(result.status).toBe("ready");
    expect(result.route?.usedTransitionIds).toEqual(["shared-stairs"]);
    expect(result.route?.segments.filter(({ kind: segmentKind }) => segmentKind === "transition").map(({ points }) => points[0])).toEqual([
      { x: 6.5, y: 5 },
      { x: 6.5, y: 5 },
    ]);
  });
});
