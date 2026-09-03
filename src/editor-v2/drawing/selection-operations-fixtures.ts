import { localizeRegion } from "../geometry/region-transform";
import { createBuildingWithDefaultLevel, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";

function selectionTestIdentity() {
  let index = 0;
  return { createId: () => `id-${++index}`, createRoomName: (room: number) => `Room ${room}` };
}

export function projectWithHouse() {
  const identity = selectionTestIdentity();
  let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
  const house = localizeRegion({ kind: "rectangle", x: 20, y: 20, width: 20, height: 14 });
  project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "map", name: "House", levelName: "Floor", boundary: house.boundary, transform: house.transform }, identity);
  return { project, identity };
}
