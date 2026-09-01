import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import type { EditableSelection } from "../drawing/selection-operations";
import { applyPlanningAlignment, planningSelectionFrames, useEditorPlanning } from "./use-editor-planning";
import { chooseInstrument } from "../toolbox/toolbox-state";

function demoProject(overrides: Partial<EditorProject> = {}): EditorProject {
  const project = emptyProject("planning", "Planning");
  project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -100, y: -100, width: 300, height: 300 }, tags: [], access: [], properties: {} }, { id: "level", parentId: "world", name: "Level", kind: "level", transform: { x: 10, y: 8, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 }, tags: [], access: [], properties: {} }];
  project.elements = [{ id: "element-a", belongsToId: "level", name: "A", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 5, y: 8, width: 10, height: 5 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, { id: "element-b", belongsToId: "level", name: "B", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 30, y: 20, width: 10, height: 5 } }, visible: true, locked: false, tags: [], access: [], properties: {} }];
  project.surfaces = [{ id: "surface-a", belongsToId: "level", name: "Surface A", kind: "platform", shape: { kind: "rectangle", x: 55, y: 2, width: 10, height: 5 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, { id: "surface-b", belongsToId: "level", name: "Surface B", kind: "platform", shape: { kind: "rectangle", x: 75, y: 25, width: 10, height: 5 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }];
  return { ...project, ...overrides };
}

const identity = { createId: () => "new", createRoomName: () => "Room" };

describe("use-editor-planning", () => {
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  it("returns the localized selection actions and inspector readout", () => {
    const session = new EditorSession(demoProject(), { initialPlaceId: "level", createId: () => "new" }); const state = session.getState();
    function Harness() { const planning = useEditorPlanning({ session, snapshot: state, selections: [{ kind: "element", id: "element-a" }, { kind: "element", id: "element-b" }], locale: "pl", refresh: vi.fn() }); return createElement("section", null, planning.planningActionsView, planning.inspector); }
    const html = renderToStaticMarkup(createElement(Harness)); expect(html).toContain("Wyrównaj początek"); expect(html).not.toContain("Width");
  });

  it("aligns a mixed element/surface selection in the active coordinate system", () => {
    const project = demoProject(); const selections: EditableSelection[] = [{ kind: "element", id: "element-a" }, { kind: "surface", id: "surface-a" }, { kind: "element", id: "element-b" }]; const before = structuredClone(project);
    const result = applyPlanningAlignment(project, "level", selections, { kind: "align", axis: "vertical", edge: "start" }, false, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements.find(({ id }) => id === "element-a")?.geometry).toMatchObject({ kind: "region", shape: { y: 2 } }); expect(result.project.elements.find(({ id }) => id === "element-b")?.geometry).toMatchObject({ kind: "region", shape: { y: 2 } }); expect(result.project.surfaces[0].shape).toMatchObject({ y: 2 }); expect(project).toEqual(before);
  });
  it("converts the active-space delta back into a rotated owner space", () => {
    const base = demoProject(); const project = { ...base, places: [...base.places, { id: "annex", parentId: "world", name: "Annex", kind: "level" as const, transform: { x: 140, y: 0, rotation: 90 }, boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 100, height: 80 }, tags: [], access: [], properties: {} }], elements: [...base.elements, { id: "element-c", belongsToId: "annex", name: "C", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: 30, y: 10, width: 10, height: 5 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const result = applyPlanningAlignment(project, "world", [{ kind: "element", id: "element-a" }, { kind: "element", id: "element-c" }], { kind: "align", axis: "vertical", edge: "start" }, false, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements.find(({ id }) => id === "element-c")?.geometry).toMatchObject({ kind: "region", shape: { kind: "rectangle", x: 16, y: 10 } }); expect(project.elements.find(({ id }) => id === "element-c")?.geometry).toMatchObject({ kind: "region", shape: { x: 30, y: 10 } });
  });
  it("plans all moves before committing and blocks locked members", () => {
    const project = demoProject({ elements: demoProject().elements.map((element) => element.id === "element-b" ? { ...element, locked: true } : element) }); const selections: EditableSelection[] = [{ kind: "element", id: "element-a" }, { kind: "element", id: "element-b" }]; const before = structuredClone(project);
    expect(applyPlanningAlignment(project, "level", selections, { kind: "align", axis: "horizontal", edge: "start" }, false, identity)).toMatchObject({ state: "blocked", reason: "locked" }); expect(project).toEqual(before);
  });
  it("keeps nested selections out of group planning and rejects unsupported transitions", () => {
    const project = demoProject(); const frames = planningSelectionFrames(project, "level", [{ kind: "place", id: "world" }, { kind: "element", id: "element-a" }]); expect(frames).toHaveLength(0);
    expect(applyPlanningAlignment(project, "level", [{ kind: "transition", id: "missing" }], { kind: "align", axis: "horizontal", edge: "start" }, false, identity).state).toBe("blocked");
  });
  it("creates one undoable session transaction after a successful plan", () => {
    const project = demoProject(); const session = new EditorSession(project, { initialPlaceId: "level", createId: () => "new" }); const result = applyPlanningAlignment(session.getState().project, "level", [{ kind: "element", id: "element-a" }, { kind: "element", id: "element-b" }], { kind: "align", axis: "horizontal", edge: "start" }, false, identity); expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(session.executeTransaction({ id: "planning:align", apply: () => result.project }).changed).toBe(true); expect(session.getHistoryState().canUndo).toBe(true); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(project);
  });
  it("exposes callbacks that commit the complete mixed selection in one transaction", () => {
    const project = demoProject(); const session = new EditorSession(project, { initialPlaceId: "level", createId: () => "new" }); const snapshot = session.getState(); let actions: ReturnType<typeof useEditorPlanning>["planningActions"] | undefined;
    function Harness() { actions = useEditorPlanning({ session, snapshot, selections: [{ kind: "element", id: "element-a" }, { kind: "surface", id: "surface-a" }, { kind: "element", id: "element-b" }], locale: "en", refresh: vi.fn() }).planningActions; return null; }
    const container = document.createElement("div"); const root = createRoot(container); act(() => root.render(createElement(Harness))); expect(actions?.canAlign).toBe(true); expect(actions?.canDistribute).toBe(true);
    act(() => actions?.onAlign("vertical", "start")); expect(session.getHistoryState().canUndo).toBe(true); expect(session.getState().project.elements.find(({ id }) => id === "element-b")?.geometry).toMatchObject({ kind: "region", shape: { y: 2 } }); act(() => root.unmount());
  });
  it("splits an open road only at an explicitly selected interior node", () => {
    const base = demoProject(); const path = { id: "path", belongsToId: "level", name: "Path", layerId: "roads" as const, subjectId: "road.paved", widthMeters: 4, geometry: { kind: "path" as const, points: [{ x: 5, y: 5 }, { x: 10, y: 10 }, { x: 15, y: 5 }, { x: 20, y: 10 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }; const project = { ...base, elements: [...base.elements, path] }; const session = new EditorSession(project, { initialPlaceId: "level", createId: () => "split-id" }); const snapshot = session.getState(); let inspector: ReturnType<typeof useEditorPlanning>["geometryInspector"];
    function Harness() { inspector = useEditorPlanning({ session, snapshot, selections: [{ kind: "element", id: "path" }], locale: "en", refresh: vi.fn() }).geometryInspector; return createElement("section", null, inspector); }
    const container = document.createElement("div"); const root = createRoot(container); act(() => root.render(createElement(Harness))); const select = container.querySelector("select")!; act(() => { select.value = "1"; select.dispatchEvent(new Event("change", { bubbles: true })); }); const split = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Split")); expect(split).toBeDefined(); act(() => split!.click());
    expect(session.getState().project.elements).toHaveLength(project.elements.length + 1); expect(session.getState().project.elements.find(({ id }) => id === "path")?.geometry).toMatchObject({ kind: "path", points: path.geometry.points.slice(0, 2) }); expect(session.getState().project.elements.filter(({ id }) => id !== "path").find((element) => element.geometry.kind === "path" && element.geometry.points.length === 3)?.geometry).toMatchObject({ kind: "path", points: path.geometry.points.slice(1) }); expect(session.getHistoryState().canUndo).toBe(true); act(() => root.unmount());
  });
  it("inserts before the final open node and preserves road ribbon metadata", () => {
    const base = demoProject(); const road = { id: "insert-road", belongsToId: "level", name: "Insert road", layerId: "roads" as const, subjectId: "road.paved", widthMeters: 6, widthProfile: [{ t: 0, left: 3, right: 3 }, { t: 1, left: 4, right: 5 }], ribbonCutouts: [{ kind: "rectangle" as const, x: 8, y: 8, width: 2, height: 2 }], geometry: { kind: "path" as const, points: [{ x: 5, y: 5 }, { x: 15, y: 10 }, { x: 25, y: 5 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }; const project = { ...base, elements: [...base.elements, road] }; const session = new EditorSession(project, { initialPlaceId: "level" }); const snapshot = session.getState();
    let planning: ReturnType<typeof useEditorPlanning> | undefined; function Harness() { planning = useEditorPlanning({ session, snapshot, selections: [{ kind: "element", id: "insert-road" }], locale: "en", refresh: vi.fn() }); return createElement("section", null, planning.geometryInspector); }
    const container = document.createElement("div"); const root = createRoot(container); act(() => root.render(createElement(Harness))); const select = container.querySelector("select")!; act(() => { select.value = "0"; select.dispatchEvent(new Event("change", { bubbles: true })); }); const add = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Add handle")); expect(add).toBeDefined(); act(() => add!.click()); expect(planning?.nodeInsertion.active).toBe(true); expect(session.getState().project.elements.find(({ id }) => id === "insert-road")?.geometry).toEqual(road.geometry); act(() => planning?.nodeInsertion.insertAt({ x: 20, y: 7.5 })); expect(container.querySelector("select")?.value).toBe("2");
    const changed = session.getState().project.elements.find(({ id }) => id === "insert-road")!; expect(changed.geometry).toMatchObject({ kind: "path", points: [{ x: 5, y: 5 }, { x: 15, y: 10 }, { x: 20, y: 7.5 }, { x: 25, y: 5 }] }); expect(changed.widthProfile).toEqual(road.widthProfile); expect(changed.ribbonCutouts).toEqual(road.ribbonCutouts); expect(session.getHistoryState().canUndo).toBe(true); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(project); act(() => root.unmount());
  });
  it("deactivates controlled insertion when the drawing context changes", () => {
    const base = demoProject(); const project = { ...base, elements: base.elements.map((element) => element.id === "element-a" ? { ...element, geometry: { kind: "region" as const, shape: { kind: "polygon" as const, points: [{ x: 5, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 13 }, { x: 5, y: 13 }] } } } : element) }; const session = new EditorSession(project, { initialPlaceId: "level" }); let snapshot = session.getState(); let planning: ReturnType<typeof useEditorPlanning> | undefined;
    function Harness() { planning = useEditorPlanning({ session, snapshot, selections: [{ kind: "element", id: "element-a" }], locale: "en", refresh: vi.fn() }); return createElement("section", null, planning.geometryInspector); }
    const container = document.createElement("div"); const root = createRoot(container); act(() => root.render(createElement(Harness))); const add = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Add handle")); expect(add).toBeDefined(); act(() => add!.click()); expect(planning?.nodeInsertion.active).toBe(true);
    act(() => { session.setToolbox(chooseInstrument(session.getState().toolbox, "rectangle")); snapshot = session.getState(); root.render(createElement(Harness)); }); expect(planning?.nodeInsertion.active).toBe(false);
    act(() => { session.setBoundaryEditing(true); snapshot = session.getState(); root.render(createElement(Harness)); }); expect(planning?.nodeInsertion.active).toBe(false); const addDuringBoundaryEdit = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Add handle")); expect(addDuringBoundaryEdit).toBeDefined(); act(() => addDuringBoundaryEdit!.click()); expect(planning?.nodeInsertion.active).toBe(true); act(() => root.unmount());
  });
});
