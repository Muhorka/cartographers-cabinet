import { describe, expect, it } from "vitest";
import { createContainedRegionObstacleIndex, type RegionLabelObstacleSource } from "./contained-region-label-obstacles";

const court: RegionLabelObstacleSource = {
  id: "court",
  ownerId: "location",
  shape: { kind: "rectangle", x: -40, y: 30, width: 80, height: 48 },
};
const fountain: RegionLabelObstacleSource = {
  id: "fountain",
  ownerId: "location",
  shape: { kind: "circle", cx: 0, cy: 54, radius: 3 },
};

describe("contained region label obstacles", () => {
  it("returns a smaller same-owner region contained by the target", () => {
    const index = createContainedRegionObstacleIndex([court, fountain]);

    expect(index.forTarget(court)).toHaveLength(1);
    expect(index.forTarget(court)[0]?.outer).toHaveLength(48);
    expect(index.forTarget(fountain)).toHaveLength(0);
  });

  it("does not treat a different owner or a partial overlap as an obstacle", () => {
    const outside: RegionLabelObstacleSource = { id: "outside", ownerId: "location", shape: { kind: "rectangle", x: 35, y: 60, width: 20, height: 10 } };
    const differentOwner: RegionLabelObstacleSource = { ...fountain, id: "other-fountain", ownerId: "other" };
    const index = createContainedRegionObstacleIndex([court, outside, differentOwner]);

    expect(index.forTarget(court)).toHaveLength(0);
  });

  it("keeps relative geometry stable when target and child move together", () => {
    const movedCourt = { ...court, translation: { x: 12, y: -4 } };
    const movedFountain = { ...fountain, translation: { x: 12, y: -4 } };
    const index = createContainedRegionObstacleIndex([movedCourt, movedFountain]);
    const [obstacle] = index.forTarget(movedCourt);

    expect(obstacle?.outer[0]).toEqual({ x: 3, y: 54 });
  });

  it("accounts for a child moving relative to its target", () => {
    const index = createContainedRegionObstacleIndex([{ ...court }, { ...fountain, translation: { x: 5, y: 0 } }]);
    const [obstacle] = index.forTarget(court);

    expect(obstacle?.outer[0]?.x).toBeCloseTo(8);
  });

  it("rejects a source whose edges leave a concave U-shaped target", () => {
    const target: RegionLabelObstacleSource = {
      id: "u-shaped-target",
      ownerId: "location",
      shape: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
          { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 },
        ],
      },
    };
    const crossing: RegionLabelObstacleSource = {
      id: "crossing",
      ownerId: "location",
      shape: { kind: "rectangle", x: 1, y: 5, width: 8, height: 1 },
    };

    expect(createContainedRegionObstacleIndex([target, crossing]).forTarget(target)).toHaveLength(0);
  });

  it("rejects a source that crosses a concave hole despite all source corners lying in the target", () => {
    const target: RegionLabelObstacleSource = {
      id: "target-with-hole",
      ownerId: "location",
      shape: {
        kind: "compound",
        polygons: [{
          outer: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 }],
          holes: [[
            { x: 2, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 10 }, { x: 8, y: 10 },
            { x: 8, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 2, y: 10 },
          ]],
        }],
      },
    };
    const crossing: RegionLabelObstacleSource = {
      id: "crossing-hole",
      ownerId: "location",
      shape: { kind: "rectangle", x: 1, y: 5, width: 10, height: 1 },
    };

    expect(createContainedRegionObstacleIndex([target, crossing]).forTarget(target)).toHaveLength(0);
  });

  it("limits exact containment candidates on a large spatially separated sheet", () => {
    const sources: RegionLabelObstacleSource[] = [];
    let target: RegionLabelObstacleSource | undefined;
    for (let index = 0; index < 600; index += 1) {
      const left = index * 100;
      const region: RegionLabelObstacleSource = {
        id: `region-${index}`,
        ownerId: "large-sheet",
        shape: { kind: "rectangle", x: left, y: 0, width: 20, height: 20 },
      };
      sources.push(region, {
        id: `child-${index}`,
        ownerId: "large-sheet",
        shape: { kind: "rectangle", x: left + 5, y: 5, width: 3, height: 3 },
      });
      if (index === 300) target = region;
    }

    const metrics = createContainedRegionObstacleIndex(sources).metricsForTarget(target!);
    expect(metrics).toEqual({ sourceCount: 1_200, scanned: 2, bboxCandidates: 1 });
  });
});
