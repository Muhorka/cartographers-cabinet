import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlaceNode } from "../model/project-model";
import { HierarchyNavigator, type HierarchyNavigatorCopy } from "./hierarchy-navigator";

const copy: HierarchyNavigatorCopy = {
  ariaLabel: "Project atlas",
  openPlace: "Open place",
  expandPlace: "Show contents",
  collapsePlace: "Hide contents",
  addContainingPlace: "Add a broader map level",
  addLevel: "Add a new level",
  reorderLevel: "Drag to reorder levels",
  containingKind: "Which scale?",
  containingName: "Name",
  createContaining: "Add scale",
  cancel: "Cancel",
  noPlaces: "No places yet",
  kindLabels: {
    world: "world",
    location: "location",
    building: "building",
    level: "floor",
    room: "room",
    object: "object",
    "standalone-room": "room",
    custom: "place",
  },
};

const place = (id: string, name: string, kind: PlaceNode["kind"], parentId?: string): PlaceNode => ({
  id,
  name,
  kind,
  parentId,
  transform: { x: 0, y: 0, rotation: 0 },
  tags: [],
  access: [],
  properties: {},
});

const places = [
  place("world", "The continent whose exceptionally long name must remain readable", "world"),
  place("town", "The Copper Town", "location", "world"),
  place("house", "The Cartographer's House", "building", "town"),
  place("ground", "Ground floor", "level", "house"),
  place("upper", "Upper floor", "level", "house"),
];

const renderNavigator = (expandedPlaceIds: ReadonlySet<string>, activePlaceId = "ground") => renderToStaticMarkup(createElement(HierarchyNavigator, {
  places,
  activePlaceId,
  expandedPlaceIds,
  copy,
  onOpenPlace: vi.fn(),
  onExpandedChange: vi.fn(),
  onAddContainingPlace: vi.fn(),
  onAddLevel: vi.fn(),
  onReorderLevel: vi.fn(),
}));

describe("editor v2 hierarchy navigator", () => {
  it("shows full names and explicit floors when the atlas branches are open", () => {
    const html = renderNavigator(new Set(["world", "town", "house"]));
    expect(html).toContain("The continent whose exceptionally long name must remain readable");
    expect(html).toContain("Ground floor");
    expect(html).toContain("Upper floor");
    expect(html).toContain("floor");
    expect(html).not.toContain("…");
  });

  it("offers level creation at a building and renders levels in their chosen order", () => {
    const reordered = places.map((item) => item.id === "ground" ? { ...item, order: 2 } : item.id === "upper" ? { ...item, order: 0 } : item);
    const html = renderToStaticMarkup(createElement(HierarchyNavigator, { places: reordered, activePlaceId: "house", expandedPlaceIds: new Set(["world", "town", "house"]), copy, onOpenPlace: vi.fn(), onExpandedChange: vi.fn(), onAddLevel: vi.fn(), onReorderLevel: vi.fn() }));
    expect(html).toContain("Add a new level");
    expect(html.indexOf("Upper floor")).toBeLessThan(html.indexOf("Ground floor"));
    expect(html).toContain("Drag to reorder levels");
  });

  it("hides nested places when a branch is closed and marks the open place", () => {
    const closedHtml = renderNavigator(new Set());
    expect(closedHtml).not.toContain("The Copper Town");
    const openHtml = renderNavigator(new Set(["world", "town", "house"]));
    expect(openHtml).toContain('aria-current="page"');
    expect(openHtml).toContain('aria-expanded="true"');
  });

  it("contains only navigable places and keeps the broader-level action available inside a branch", () => {
    const nestedHtml = renderNavigator(new Set(["world", "town", "house"]));
    expect(nestedHtml).toContain("Add a broader map level");
    const rootHtml = renderNavigator(new Set(["world", "town", "house"]), "world");
    expect(rootHtml).toContain("Add a broader map level");
    expect(rootHtml).not.toContain("pencil stroke");
    expect(rootHtml).not.toContain("parent");
    expect(rootHtml).not.toContain("child");
  });

  it("opens a room leaf when it owns a named construction surface", () => {
    const surface = { id: "terrace", belongsToId: "ground", name: "South terrace", kind: "terrace" as const, shape: { kind: "rectangle" as const, x: 0, y: 0, width: 4, height: 3 }, attachment: "free" as const, elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} };
    const html = renderToStaticMarkup(createElement(HierarchyNavigator, { places, surfaces: [surface], activePlaceId: "ground", expandedPlaceIds: new Set(["world", "town", "house", "ground"]), copy, onOpenPlace: vi.fn(), onExpandedChange: vi.fn(), onSelectSurface: vi.fn() }));
    expect(html).toContain("South terrace");
    expect(html).toContain("Construction surface");
    expect(html).toContain('aria-expanded="true"');
  });
});
