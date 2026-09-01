import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { EditableSelection } from "../drawing/selection-operations";
import { workbenchCopy } from "../i18n/workbench-copy";
import { emptyProject, type EditorProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { useEditorPlanning } from "./use-editor-planning";

type PlanningApi = ReturnType<typeof useEditorPlanning>;
type MountedPlanning = {
  container: HTMLDivElement;
  refresh: ReturnType<typeof vi.fn>;
  root: Root;
  planning(): PlanningApi;
};

const roots: Root[] = [];

function rejectionProject(): EditorProject {
  const project = emptyProject("planning-rejection", "Planning rejection");
  project.places = [
    { id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -100, y: -100, width: 300, height: 300 }, tags: [], access: [], properties: {} },
    { id: "level", parentId: "world", name: "Level", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 }, tags: [], access: [], properties: {} },
  ];
  project.elements = [
    { id: "element-a", belongsToId: "level", name: "A", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 5, y: 8, width: 10, height: 5 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "element-b", belongsToId: "level", name: "B", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 30, y: 20, width: 10, height: 5 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "path", belongsToId: "level", name: "Path", layerId: "equipment", subjectId: "equipment.other", geometry: { kind: "path", points: [{ x: 5, y: 5 }, { x: 15, y: 10 }, { x: 25, y: 5 }, { x: 35, y: 10 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} },
  ];
  return project;
}

function mountPlanning(session: EditorSession, selections: EditableSelection[]): MountedPlanning {
  const container = document.createElement("div");
  const root = createRoot(container);
  const refresh = vi.fn();
  let current: PlanningApi | undefined;
  function Harness() {
    current = useEditorPlanning({ session, snapshot: session.getState(), selections, locale: "en", refresh });
    return createElement("section", null, current.planningActionsView, current.inspector);
  }
  roots.push(root);
  act(() => root.render(createElement(Harness)));
  return { container, refresh, root, planning: () => current! };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(label));
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

describe("planning transaction rejection", () => {
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => {
    for (const root of roots.splice(0)) act(() => root.unmount());
    vi.restoreAllMocks();
  });

  it("keeps an alignment rejection out of history and exposes the central failure notice", () => {
    const project = rejectionProject();
    const session = new EditorSession(project, { initialPlaceId: "level" });
    const mounted = mountPlanning(session, [{ kind: "element", id: "element-a" }, { kind: "element", id: "element-b" }]);
    const execute = vi.spyOn(session, "executeTransaction").mockReturnValueOnce({ code: "transaction-failed", changed: false, reason: "Synthetic rejection" });

    act(() => mounted.planning().planningActions.onAlign("horizontal", "start"));

    expect(session.getState().project).toEqual(project);
    expect(session.getHistoryState().canUndo).toBe(false);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ id: "planning:align:horizontal:start" }));
    expect(mounted.planning().notice).toBe(workbenchCopy.en.editingStatus.blocked["transaction-failed"]);
    expect(mounted.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps node insertion active when its geometry transaction is rejected", () => {
    const project = rejectionProject();
    const session = new EditorSession(project, { initialPlaceId: "level" });
    const mounted = mountPlanning(session, [{ kind: "element", id: "path" }]);
    const execute = vi.spyOn(session, "executeTransaction").mockReturnValueOnce({ code: "road-obstacle", changed: false });
    act(() => button(mounted.container, "Add handle").click());

    act(() => mounted.planning().nodeInsertion.insertAt({ x: 20, y: 7.5 }));

    expect(session.getState().project).toEqual(project);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ id: "planning:insert-node-at:path" }));
    expect(mounted.planning().nodeInsertion.active).toBe(true);
    expect(mounted.container.querySelector("select")?.value).toBe("0");
    expect(mounted.planning().notice).toBe(workbenchCopy.en.editingStatus.blocked["road-obstacle"]);
    expect(mounted.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected split node and original path when the split transaction is rejected", () => {
    const project = rejectionProject();
    const session = new EditorSession(project, { initialPlaceId: "level" });
    const mounted = mountPlanning(session, [{ kind: "element", id: "path" }]);
    const select = mounted.container.querySelector("select")!;
    act(() => { select.value = "1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const execute = vi.spyOn(session, "executeTransaction").mockReturnValueOnce({ code: "transaction-failed", changed: false, reason: "Synthetic rejection" });

    act(() => button(mounted.container, "Split at this node").click());

    expect(session.getState().project).toEqual(project);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ id: "planning:split-path:path:1" }));
    expect(mounted.container.querySelector("select")?.value).toBe("1");
    expect(button(mounted.container, "Split at this node").disabled).toBe(false);
    expect(mounted.planning().notice).toBe(workbenchCopy.en.editingStatus.blocked["transaction-failed"]);
    expect(mounted.refresh).toHaveBeenCalledTimes(1);
  });
});
