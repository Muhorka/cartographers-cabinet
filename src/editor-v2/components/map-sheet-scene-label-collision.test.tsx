import { describe, expect, it } from "vitest";
import { createSceneLabelPlan } from "./map-sheet-scene";
import { visiblePlaceGroups } from "./map-sheet-geometry";
import { emptyProject } from "../model/project-model";

const regionElement = (id: string, name: string, shape: { kind: "rectangle"; x: number; y: number; width: number; height: number } | { kind: "circle"; cx: number; cy: number; radius: number }) => ({
  id,
  belongsToId: "location",
  name,
  layerId: "terrain" as const,
  subjectId: "terrain.custom",
  geometry: { kind: "region" as const, shape },
  visible: true,
  locked: false,
  tags: [],
  access: [],
  properties: {},
});

function demoProject() {
  const project = emptyProject("demo", "Demo");
  project.places.push({ id: "location", name: "Estate", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
  project.elements.push(
    regionElement("court", "Court of Honour", { kind: "rectangle", x: -40, y: 30, width: 80, height: 48 }),
    regionElement("fountain", "Court of Honour Fountain", { kind: "circle", cx: 0, cy: 54, radius: 3 }),
  );
  return project;
}

describe("scene label source geometry", () => {
  it("keeps a large region label away from a contained terrain region", () => {
    const project = demoProject();
    const plan = createSceneLabelPlan(project, "location", visiblePlaceGroups(project, "location"), undefined, undefined, project.places[0], 1, false, "metric", true, new Set());
    const court = plan.get("element:location:court");

    expect(court && "kind" in court && court.kind).toBe("inside");
    if (!court || !("kind" in court) || court.kind !== "inside") return;
    expect(court.y < 48 || court.y > 63).toBe(true);
  });

  it("does not add a sibling that is only partially overlapping or on another layer", () => {
    const project = demoProject();
    const baseline = createSceneLabelPlan(project, "location", visiblePlaceGroups(project, "location"), undefined, undefined, project.places[0], 1, false, "metric", true, new Set()).get("element:location:court");
    project.elements.push(regionElement("partial", "Partial", { kind: "rectangle", x: 35, y: 60, width: 20, height: 10 }));
    const otherLayer = { ...regionElement("other-layer", "Other layer", { kind: "rectangle", x: -10, y: 45, width: 20, height: 10 }), layerId: "equipment" as const };
    project.elements.push(otherLayer);
    const plan = createSceneLabelPlan(project, "location", visiblePlaceGroups(project, "location"), undefined, undefined, project.places[0], 1, false, "metric", true, new Set());

    expect(plan.get("element:location:court")).toEqual(baseline);
  });
});
