import { expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { cutRegionFromSelection } from "./cutout-operation";
import { addRegionToOutline } from "./add-to-outline-operation";
import { pointInRegion } from "../geometry/region-constraints";
import { repairProjectConstructions } from "../model/construction-repair";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";

it("keeps the courtyard and an untouched window when adding a floor projection, including saved reload", () => {
  let project = createStarterProject("p", "Synthetic outline", "pl");
  const plan = project.constructions[0];
  const north = plan.walls.find(({ start, end }) => start.y === -11 && end.y === -11)!;
  plan.openings.push({ id: "window", kind: "window", wallId: north.id, position: .2, width: 1 });
  let count = 0; const identity = { createId: () => `shape-${++count}`, createRoomName: (index: number) => `Room ${index}` };
  const target = { kind: "place" as const, id: "p:level" };
  const cut = cutRegionFromSelection(project, "p:level", target, { kind: "rectangle", x: -2, y: -2, width: 4, height: 4 }, identity);
  expect(cut.state).toBe("applied"); if (cut.state !== "applied") throw new Error(cut.reason);
  const add = addRegionToOutline(cut.project, "p:level", target, { kind: "rectangle", x: 15, y: -3, width: 6, height: 6 }, identity);
  expect(add.state).toBe("applied"); if (add.state !== "applied") throw new Error(add.reason);
  project = repairProjectConstructions(parseProjectFile(serializeProjectFile(add.project)).project, { ...identity, createName: identity.createRoomName });
  const floor = project.places.find(({ id }) => id === "p:level")!;
  expect(pointInRegion({ x: 0, y: 0 }, floor.boundary!)).toBe(false);
  expect(pointInRegion({ x: 20, y: 0 }, floor.boundary!)).toBe(true);
  const changed = project.constructions.find(({ id }) => id === plan.id)!;
  expect(changed.openings).toEqual([{ id: "window", kind: "window", wallId: north.id, position: .2, width: 1 }]);
  expect(project.places.filter(({ kind }) => kind === "room").some(({ boundary }) => boundary && pointInRegion({ x: 0, y: 0 }, boundary))).toBe(false);
});
