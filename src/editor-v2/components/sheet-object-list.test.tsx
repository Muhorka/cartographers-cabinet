import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { SheetObjectList } from "./sheet-object-list";
import { applyMapGesture } from "../drawing/map-gesture-command";

const copy = {
  title: "Objects on this sheet", places: "Places", terrain: "Terrain", equipment: "Objects", surfaces: "Platforms and balconies", sketch: "Sketch", rooms: "Rooms", walls: "Walls", features: "Doors, windows and stairs", empty: "Nothing here", noResults: "No results", search: "Search objects", show: "Show", hide: "Hide", lock: "Lock", unlock: "Unlock",
  wallName: (index: number) => `Wall ${index}`, openingName: (kind: "door" | "window" | "gate" | "passage", index: number) => `${kind} ${index}`, stairsName: (index: number) => `Stairs ${index}`,
};

describe("editor v2 sheet object list", () => {
  it("lists rooms and keeps individually selectable walls in a collapsed group", () => {
    const project = createStarterProject("project", "Project", "en");
    const html = renderToStaticMarkup(createElement(SheetObjectList, { project, activePlaceId: "project:level", copy, onSelect: vi.fn() }));
    expect(html).toContain("Room 1"); expect(html).toContain("Walls"); expect(html).toContain("Wall 1");
    expect(html).toContain("<details>");
  });

  it("lists only the walls and openings belonging to an opened room", () => {
    const identity = { createId: (() => { let index = 0; return () => `new-${++index}`; })(), createRoomName: (index: number) => `Room ${index}` };
    const naming = { nameFor: (subject: string, index: number) => `${subject} ${index}`, levelName: () => "Ground floor" };
    const divided = applyMapGesture(createStarterProject("project", "Project", "en"), { activePlaceId: "project:level", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: 0, y: -11 }, { x: 0, y: 11 }] } }, identity, naming).project;
    const construction = divided.constructions[0]; const west = construction.walls.find(({ start, end }) => start.x === -16 && end.x === -16)!; const east = construction.walls.find(({ start, end }) => start.x === 16 && end.x === 16)!;
    const project = { ...divided, constructions: [{ ...construction, openings: [{ id: "left", kind: "door" as const, wallId: west.id, position: .5, width: 1 }, { id: "right", kind: "window" as const, wallId: east.id, position: .5, width: 1 }] }] };
    const leftRoom = project.places.find(({ kind, boundary }) => kind === "room" && boundary?.kind === "polygon" && boundary.points.some(({ x }) => x < 0))!;
    const html = renderToStaticMarkup(createElement(SheetObjectList, { project, activePlaceId: leftRoom.id, copy, onSelect: vi.fn() }));
    expect(html).toContain("door 1"); expect(html).not.toContain("window 1");
  });

  it("groups drawn objects by layer and offers real visibility and lock controls", () => {
    const base = createStarterProject("project", "Project", "en");
    const project = { ...base, elements: [{ id: "pond", belongsToId: "project:level", name: "Hidden pond", description: "Behind the mill", layerId: "terrain" as const, subjectId: "terrain.water", geometry: { kind: "point" as const, at: { x: 0, y: 0 } }, visible: false, locked: true, tags: ["water"], access: [], properties: {} }] };
    const html = renderToStaticMarkup(createElement(SheetObjectList, { project, activePlaceId: "project:level", copy, onSelect: vi.fn(), onUpdateElement: vi.fn() }));
    expect(html).toContain("Terrain"); expect(html).toContain("Hidden pond"); expect(html).toContain("water");
    expect(html).toContain('aria-label="Show: Hidden pond"'); expect(html).toContain('aria-label="Unlock: Hidden pond"');
  });

  it("offers the shared delete action for every listed entity kind", () => {
    const project = createStarterProject("project", "Project", "en");
    const html = renderToStaticMarkup(createElement(SheetObjectList, { project, activePlaceId: "project:level", copy, onSelect: vi.fn(), onDelete: vi.fn() }));
    expect((html.match(/aria-label="Delete:/g) ?? []).length).toBeGreaterThan(3);
  });

  it("starts collapsed and preserves manual group state across data updates", () => {
    const base = createStarterProject("project", "Project", "en");
    const project = { ...base, elements: [{ id: "tree", belongsToId: "project:level", name: "Tree", layerId: "terrain" as const, subjectId: "terrain.forest", geometry: { kind: "point" as const, at: { x: 2, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    act(() => root.render(createElement(SheetObjectList, { project, activePlaceId: "project:level", copy, onSelect: vi.fn() })));
    const terrain = [...host.querySelectorAll("details")].find((item) => item.querySelector("summary")?.textContent?.startsWith("Terrain")) as HTMLDetailsElement;
    expect([...host.querySelectorAll("details")].every((item) => !(item as HTMLDetailsElement).open)).toBe(true);
    act(() => { terrain.open = true; terrain.dispatchEvent(new Event("toggle", { bubbles: true })); });
    act(() => root.render(createElement(SheetObjectList, { project: { ...project, updatedAt: new Date().toISOString() }, activePlaceId: "project:level", copy, onSelect: vi.fn() })));
    expect(terrain.open).toBe(true);
    act(() => { terrain.open = false; terrain.dispatchEvent(new Event("toggle", { bubbles: true })); });
    act(() => root.render(createElement(SheetObjectList, { project: { ...project, updatedAt: new Date().toISOString() }, activePlaceId: "project:level", copy, onSelect: vi.fn() })));
    expect(terrain.open).toBe(false);
    const search = host.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => { setNativeValue(search, "tree"); search.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(terrain.open).toBe(true);
    act(() => { setNativeValue(search, ""); search.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(terrain.open).toBe(false);
    act(() => root.unmount()); host.remove();
  });
});

function setNativeValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(element, value);
}
