import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { createPlace } from "../model/hierarchy-operations";
import { projectThumbnailSvg, renderProjectViewSvg } from "./project-renderer";

describe("editor v2 export renderer", () => {
  it("keeps the exported narrow region clip outside rotated lettering", () => {
    const project = emptyProject("labels", "Labels");
    project.places.push({ id: "world", name: "Świat", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "narrow", belongsToId: "world", name: "Budynek 1", layerId: "terrain", subjectId: "terrain.meadow", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 3, height: 12 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const svg = renderProjectViewSvg({ project, activePlaceId: "world", viewport: { center: { x: 0, y: 0 }, zoom: 8, rotation: 0 } });
    expect(svg).toMatch(/<g clip-path="url\(#[^"]+\)"><text[^>]*transform="rotate\([^>]+>Budynek 1<\/text><\/g>/);
    expect(svg).not.toMatch(/<text[^>]*clip-path=/);
  });

  it("renders a current view without selection UI and escapes authored text", () => {
    const project = createStarterProject("export-project", "Map <&>", "en");
    project.places[0]!.name = "<script>alert(1)</script>";
    project.elements.push({ id: "road", belongsToId: project.places[0]!.id, name: "Road & route", layerId: "roads", subjectId: "road.route", geometry: { kind: "bezier", nodes: [{ anchor: { x: 3, y: 4 }, outHandle: { x: 12, y: 4 } }, { anchor: { x: 40, y: 30 }, inHandle: { x: 30, y: 20 } }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {}, widthMeters: 4 } as unknown as DrawingElement);
    const svg = renderProjectViewSvg({ project, activePlaceId: project.places[0]!.id, viewport: { center: { x: 0, y: 0 }, zoom: 2, rotation: 0 } });
    expect(svg).toContain("Map &lt;&amp;&gt;");
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).toContain("#aa895a");
    expect(svg).toContain('filter id="road-soft-road"');
    expect(svg).toContain('fill-opacity=".15"');
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("data-resize-corner");
    expect(svg).not.toContain("foreignObject");
    expect(renderProjectViewSvg({ project, activePlaceId: project.places[0]!.id, viewport: { center: { x: 0, y: 0 }, zoom: 6, rotation: 0 } })).toContain('stroke-width="0.3"');
  });

  it("keeps note rotation in the exported SVG", () => {
    const project = emptyProject("notes", "Notes");
    project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "note", belongsToId: "world", name: "Note", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 1, y: 2 }, width: 12, height: 8, rotation: 37, text: "Rotated" }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const svg = renderProjectViewSvg({ project, activePlaceId: "world", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 } });
    expect(svg).toContain('transform="rotate(37 1 2)"');
  });

  it("labels large regions using their real shape and formats object areas", () => {
    const project = emptyProject("labels", "Labels");
    project.places.push({ id: "world", name: "Świat", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "meadow", belongsToId: "world", name: "Łąka", layerId: "terrain", subjectId: "terrain.meadow", geometry: { kind: "region", shape: { kind: "rectangle", x: 100, y: 80, width: 160, height: 90 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    project.measureSettings = { ...project.measureSettings, showRoomAreas: true, units: "imperial" };
    const svg = renderProjectViewSvg({ project, activePlaceId: "world", viewport: { center: { x: 180, y: 120 }, zoom: 1, rotation: 0 } });
    expect(svg).toContain("Łąka");
    expect(svg).toContain("ft²");
    expect(svg).not.toContain('radius="0.001"');
  });

  it("uses a green vegetation fallback without replacing authored colours", () => {
    const project = emptyProject("appearance", "Appearance");
    project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "plant", belongsToId: "world", name: "Plant", layerId: "equipment", subjectId: "equipment.vegetation", geometry: { kind: "point", at: { x: 2, y: 3 } }, visible: true, locked: false, tags: [], access: [], properties: {} } as DrawingElement);
    project.elements.push({ id: "tree", belongsToId: "world", name: "Authored tree", layerId: "equipment", subjectId: "equipment.vegetation", appearance: { fillColor: "#123456", fillOpacity: .7 }, geometry: { kind: "point", at: { x: 5, y: 6 } }, visible: true, locked: false, tags: [], access: [], properties: {} } as DrawingElement);
    const svg = renderProjectViewSvg({ project, activePlaceId: "world", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 } });
    expect(svg).toContain('fill="#63835f"');
    expect(svg).toContain('fill="#123456"');
  });

  it("preserves room appearance and context opacity in the export", () => {
    const project = createStarterProject("room-export", "Room export", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const room = project.places.find(({ kind }) => kind === "room")!;
    room.appearance = { fillColor: "#123456", fillOpacity: .41 };
    const svg = renderProjectViewSvg({ project, activePlaceId: level.id, viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 } });
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('fill-opacity="0.41"');
    expect(svg).toContain('aria-label="Room export · Ground floor"');
  });

  it("uses the shared stair glyph geometry in exported construction views", () => {
    const project = createStarterProject("stairs-export", "Stairs export", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    project.constructions[0]!.transitions.push({ id: "spiral", kind: "stairs", style: "spiral", footprint: { kind: "rectangle", x: -8, y: -5, width: 8, height: 8 } });
    const svg = renderProjectViewSvg({ project, activePlaceId: level.id, viewport: { center: { x: 0, y: 0 }, zoom: 2, rotation: 0 } });
    expect(svg).toContain('aria-label="stairs"');
    expect(svg).toContain('<circle cx="-4" cy="-1"');
    expect(svg).toContain('stroke-width="0.5"');
  });

  it("creates a self-contained cartographer thumbnail", () => {
    const project = createStarterProject("thumbnail-project", "A thumbnail", "en");
    const svg = projectThumbnailSvg(project);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("#e8d9b4");
    expect(svg).toContain("A thumbnail");
    expect(svg).not.toContain('aria-label="Construction"');
  });

  it("autofits a world thumbnail to visible elements without a boundary", () => {
    const project = emptyProject("sparse", "Sparse world");
    project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "tree", belongsToId: "world", name: "Tree", layerId: "terrain", subjectId: "terrain.tree", geometry: { kind: "point", at: { x: 1000, y: 800 } }, visible: true, locked: false, tags: [], access: [], properties: {} } as DrawingElement);
    project.elements.push({ id: "road", belongsToId: "world", name: "Road", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 1040, y: 820 }, { x: 1080, y: 820 }], closed: false }, widthMeters: 6, visible: true, locked: false, tags: [], access: [], properties: {} });
    const svg = projectThumbnailSvg(project);
    const transform = svg.match(/<g transform="translate\(160 95\) rotate\(0\) scale\(([^ ]+)\) translate\((-?[^ ]+) (-?[^)]+)\)"/);
    expect(transform).not.toBeNull();
    expect(Number(transform?.[1])).toBeGreaterThan(1);
    expect(Math.abs(Number(transform?.[2]))).toBeGreaterThan(900);
    expect(Math.abs(Number(transform?.[3]))).toBeGreaterThan(700);
  });

  it("maps nested owners into the active place coordinate system", () => {
    let project = emptyProject("nested", "Nested");
    project = createPlace(project, { id: "world", name: "World", kind: "world", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
    project = createPlace(project, { id: "estate", parentId: "world", name: "Estate", kind: "location", transform: { x: 10, y: 5, rotation: 0 } });
    project = createPlace(project, { id: "house", parentId: "estate", name: "House", kind: "building", transform: { x: 2, y: 3, rotation: 0 }, boundary: { kind: "rectangle", x: -4, y: -3, width: 8, height: 6 } });
    project.elements.push({ id: "well", belongsToId: "house", name: "Well", layerId: "equipment", subjectId: "equipment.well", geometry: { kind: "point", at: { x: 1, y: 1 } }, visible: true, locked: false, tags: [], access: [], properties: {} } as DrawingElement);
    const svg = renderProjectViewSvg({ project, activePlaceId: "world", viewport: { center: { x: 50, y: 40 }, zoom: 2, rotation: 0 } });
    expect(svg).toContain('transform="matrix(1 0 0 1 12 8)"');
    expect(svg).toContain('cx="1" cy="1"');
    expect(svg).toContain('opacity="0.68" aria-label="Well"');
  });
});
