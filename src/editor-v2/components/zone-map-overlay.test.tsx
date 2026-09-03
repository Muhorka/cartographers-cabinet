import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { ZoneMapOverlay } from "./zone-map-overlay";

function fixture(): EditorProject {
  const project = emptyProject("zones", "Synthetic zones");
  project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    ...["east", "west"].map((id, i) => ({ id, name: id, kind: "building" as const, parentId: "world", transform: { x: i * 10, y: 0, rotation: 0 },
      boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} }))];
  project.story.zones = [{ id: "district", name: "District", tags: [], color: "#668866", members: ["east", "west"].map((id) => ({ ref: { kind: "place" as const, id }, relation: "inside", partial: false })) }];
  return project;
}
function render(project: EditorProject, selectedZoneId?: string, activePlaceId = "world") {
  const node = document.createElement("div");
  node.innerHTML = renderToStaticMarkup(<svg><ZoneMapOverlay project={project} activePlaceId={activePlaceId} zoom={6} selectedZoneId={selectedZoneId}/></svg>);
  return node;
}
describe("zone ink shared by drawing and story", () => {
  it("shows unselected zone members without filling, hiding divisions or intercepting clicks", () => {
    const project = fixture(); const before = structuredClone(project); const node = render(project);
    expect(node.querySelector('[data-zone-overlay]')?.getAttribute("pointer-events")).toBe("none");
    expect(node.querySelectorAll("path")).toHaveLength(2);
    for (const path of node.querySelectorAll("path")) { expect(path.getAttribute("fill")).toBe("none"); expect(path.getAttribute("stroke")).toBe("#668866"); }
    expect(project).toEqual(before);
  });
  it("strengthens only the selected zone while retaining its geometry", () => {
    const project = fixture(); const normal = render(project).querySelector("path")!; const active = render(project, "district").querySelector("path")!;
    expect(active.getAttribute("d")).toBe(normal.getAttribute("d"));
    expect(Number(active.getAttribute("stroke-opacity"))).toBeGreaterThan(Number(normal.getAttribute("stroke-opacity")));
  });
  it("does not reveal a hidden member or a construction wall from a legacy membership", () => {
    const project = fixture(); project.places[1].visible = false;
    project.story.zones[0].members.push({ ref: { kind: "wall", id: "legacy-wall", scopeId: "plan" }, relation: "inside", partial: false });
    expect(render(project).querySelectorAll("path")).toHaveLength(1);
  });
  it("outlines both rooms on the visible floor but never overlays a room from another floor", () => {
    const project = fixture();
    project.places.push(...["ground", "upper"].map((id) => ({
      id, name: id, kind: "level" as const, parentId: "east", constructionId: `${id}:plan`,
      transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {},
      boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 10 },
    })));
    project.places.push(...["first", "second", "upstairs"].map((id, index) => ({
      id, name: "Room", kind: "room" as const, parentId: index === 2 ? "upper" : "ground",
      transform: { x: index === 1 ? 5 : 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {},
      boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 5, height: 10 },
    })));
    project.story.zones[0].members = ["first", "second", "upstairs"].map((id) => ({
      ref: { kind: "room", id, scopeId: id === "upstairs" ? "upper:plan" : "ground:plan" }, relation: "inside", partial: false,
    }));
    // A building with multiple levels has no single construction viewport;
    // room overlays become unambiguous once a level is active.
    expect(render(project, "district", "east").querySelectorAll("path")).toHaveLength(0);
    expect(render(project, "district", "ground").querySelectorAll("path")).toHaveLength(2);
    expect(render(project, "district", "upper").querySelectorAll("path")).toHaveLength(1);
    expect(render(project, "district", "world").querySelectorAll("path")).toHaveLength(0);
  });
});
