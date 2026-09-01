import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workbenchCopy } from "../i18n/workbench-copy";
import { createStarterProject } from "../model/starter-project";
import { SelectionActionStrip } from "./selection-action-strip";

describe("selection actions in the tool case", () => {
  const placeActions = { onDuplicatePlaces: vi.fn(), onTransformPlaces: vi.fn(), onMergePlaces: vi.fn() };
  const roomActions = { onDuplicateRooms: vi.fn(), onTransformRooms: vi.fn() };
  const surfaceActions = { onDuplicateSurfaces: vi.fn(), onTransformSurfaces: vi.fn(), onMergeSurfaces: vi.fn() };
  it("keeps named object operations in the tool case instead of the inspector", () => {
    const base = createStarterProject("project", "Project", "pl");
    const project = { ...base, elements: [{ id: "chair", belongsToId: "project:level", name: "Chair", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "point" as const, at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const action = vi.fn(); const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={[{ kind: "element", id: "chair" }]} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions}/>);
    expect(html).toContain("Operacje na zaznaczeniu"); expect(html).toContain("Powiel"); expect(html).toContain("Usuń");
  });

  it("does not hide the tool-case strip for a mixed construction selection", () => {
    const project = createStarterProject("project", "Project", "pl"); const action = vi.fn();
    const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={[{ kind: "room", id: "room" }, { kind: "wall", id: "wall" }]} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions}/>);
    expect(html).toContain("Operacje na zaznaczeniu"); expect(html).toContain("Zaznaczono: 2"); expect(html).toContain("Usuń");
  });

  it("offers full geometry operations for selected buildings", () => {
    const project = createStarterProject("project", "Project", "pl"); const original = project.places.find(({ kind }) => kind === "building")!;
    const second = { ...structuredClone(original), id: "second-building", transform: { ...original.transform, x: original.transform.x + 5 } }; project.places.push(second);
    const action = vi.fn(); const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={[{ kind: "place", id: original.id }, { kind: "place", id: second.id }]} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions}/>);
    expect(html).toContain("Powiel"); expect(html).toContain("Obróć w lewo"); expect(html).toContain("Scal — tylko obrys zewnętrzny");
  });

  it("offers duplicate, rotate and mirror for rooms as well as merging", () => {
    const project = createStarterProject("project", "Project", "pl"); const action = vi.fn();
    const rooms = project.constructions[0].rooms.map(({ id }) => ({ kind: "room" as const, id }));
    const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={rooms} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions}/>);
    expect(html).toContain("Powiel"); expect(html).toContain("Obróć w prawo"); expect(html).toContain("Odbij lewo–prawo");
  });

  it("offers the same geometry operations for compatible platforms", () => {
    const project = createStarterProject("project", "Project", "pl"); const owner = project.places.find(({ kind }) => kind === "location")!.id; const action = vi.fn();
    project.surfaces = ["one", "two"].map((id, index) => ({ id, belongsToId: owner, name: `Taras ${index + 1}`, kind: "terrace" as const, shape: { kind: "rectangle" as const, x: index * 3, y: 0, width: 4, height: 3 }, attachment: "free" as const, elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }));
    const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={[{ kind: "surface", id: "one" }, { kind: "surface", id: "two" }]} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions}/>);
    expect(html).toContain("Powiel"); expect(html).toContain("Obróć w lewo"); expect(html).toContain("Scal obrysy");
  });

  it("exposes optional planning alignment actions without changing existing callers", () => {
    const project = createStarterProject("project", "Project", "pl"); const action = vi.fn();
    const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={[{ kind: "element", id: "one" }, { kind: "element", id: "two" }, { kind: "element", id: "three" }]} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions} planningActions={{ onAlign: action, onDistribute: action }}/ >);
    expect(html).toContain("Align start"); expect(html).toContain("Distribute evenly");
  });

  it("exposes road joining only for two compatible open roads", () => {
    const base = createStarterProject("project", "Project", "pl"); const action = vi.fn();
    const owner = base.places.find(({ kind }) => kind === "location")!.id;
    const road = (id: string, x: number) => ({ id, belongsToId: owner, name: id, layerId: "roads" as const, subjectId: "road.path", geometry: { kind: "path" as const, points: [{ x, y: 0 }, { x: x + 2, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const project = { ...base, elements: [road("road-a", 0), road("road-b", 2)] };
    const html = renderToStaticMarkup(<SelectionActionStrip project={project} selections={[{ kind: "element", id: "road-a" }, { kind: "element", id: "road-b" }]} copy={workbenchCopy.pl} onDelete={action} onDuplicate={action} onRotate={action} onMirror={action} onMerge={action} onJoinRoads={action} onMergeRooms={action} {...surfaceActions} {...roomActions} {...placeActions}/>);
    expect(html).toContain(workbenchCopy.pl.selectionActions.merge);
  });
});
