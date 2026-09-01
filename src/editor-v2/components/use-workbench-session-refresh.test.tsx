import { act, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject, type EditorProject } from "../model/project-model";
import { createProjectCheckpoint } from "../persistence/project-checkpoint";
import { EditorSession } from "../state/editor-session";
import { createToolboxState } from "../toolbox/toolbox-state";
import { createEditorAgentTools } from "../webmcp/register-agent-tools";
import type { MapSelection } from "./map-sheet-types";
import { viewportFor } from "./workbench-helpers";
import type { useProjectAutosave } from "./use-project-autosave";
import { useWorkbenchProjectSwitch } from "./use-workbench-project-switch";
import { expandedPlaceIds, reconcileMapSelections, useWorkbenchSessionRefresh } from "./use-workbench-session-refresh";

const storage = vi.hoisted(() => ({ read: vi.fn(), preference: vi.fn().mockResolvedValue(undefined), error: vi.fn() }));
vi.mock("../persistence/project-library", async (original) => ({ ...await original<typeof import("../persistence/project-library")>(), readProjectCheckpoint: storage.read, setPreference: storage.preference }));

function hierarchy() {
  let project = createPlace(emptyProject("project", "Project"), { id: "world", name: "World", kind: "world" });
  project = createPlace(project, { id: "building", parentId: "world", name: "House", kind: "building" });
  return createPlace(project, { id: "ground", parentId: "building", name: "Ground", kind: "level" });
}

function projectWithEverySelection(): EditorProject {
  const project = hierarchy();
  return { ...project,
    elements: [{ id: "element", belongsToId: "ground", name: "Object", layerId: "equipment", subjectId: "equipment.object", geometry: { kind: "point", at: { x: 1, y: 1 } }, visible: true, locked: false, tags: [], access: [], properties: {} }],
    surfaces: [{ id: "surface", belongsToId: "ground", name: "Terrace", kind: "terrace", shape: { kind: "rectangle", x: 0, y: 0, width: 2, height: 2 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }],
    constructions: [{ id: "construction", revision: 0,
      walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, thickness: .2, role: "wall" }],
      rooms: [{ id: "room", faceId: "face", name: "Room", tags: [], access: [], properties: {} }],
      openings: [{ id: "opening", kind: "door", wallId: "wall", position: .5, width: 1 }],
      transitions: [{ id: "transition", kind: "stairs", footprint: { kind: "rectangle", x: 0, y: 0, width: 1, height: 2 } }],
    }],
  };
}

type Ui = { snapshot: ReturnType<EditorSession["getViewState"]>; selections: MapSelection[]; viewport: ReturnType<typeof viewportFor>; expanded: Set<string>; cutout: boolean; addOutline: boolean };
let live!: { refresh(): void; restore(): Promise<unknown>; ui: Ui };

function Probe({ session, initialSelections }: { session: EditorSession; initialSelections: MapSelection[] }) {
  const [snapshot, setSnapshot] = useState(session.getViewState()); const [selections, setSelections] = useState(initialSelections);
  const [viewport, setViewport] = useState(viewportFor(snapshot.project, snapshot.activePlaceId)); const [expanded, setExpandedIds] = useState(new Set<string>());
  const [cutout, setCutoutActive] = useState(true); const [addOutline, setAddOutlineActive] = useState(true);
  const reconciler = useWorkbenchSessionRefresh({ session, snapshot, setSnapshot, setSelections, setViewport, setExpandedIds, setCutoutActive, setAddOutlineActive });
  const navigation = useWorkbenchProjectSwitch({ session, locale: "pl", autosave: {} as ReturnType<typeof useProjectAutosave>, install: vi.fn(), onError: storage.error });
  useLayoutEffect(() => { live = {
    refresh: () => reconciler.refresh(session),
    restore: async () => { const result = await navigation.restoreCheckpoint("checkpoint", async () => "safety"); if (result) reconciler.refresh(result.session); return result; },
    ui: { snapshot, selections, viewport, expanded, cutout, addOutline },
  }; });
  return null;
}

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks(); storage.preference.mockResolvedValue(undefined); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("workbench project snapshot reconciliation", () => {
  it("recognises all seven map selection kinds and filters only missing records", () => {
    const project = projectWithEverySelection();
    const existing = (["place", "element", "surface", "room", "wall", "opening", "transition"] as const).map((kind) => ({ kind, id: kind === "place" ? "ground" : kind }));
    const mixed = existing.flatMap((selection) => [selection, { ...selection, id: `missing-${selection.kind}` }]);
    expect(reconcileMapSelections(project, existing)).toBe(existing);
    expect(reconcileMapSelections(project, mixed)).toEqual(existing);
    expect(expandedPlaceIds(project, "ground")).toEqual(["ground", "building", "world"]);
  });

  it("reconciles an actual WebMCP undo through the shared refresh boundary", async () => {
    const base = hierarchy(); const withTemporary = createPlace(base, { id: "temporary", parentId: "building", name: "Temporary", kind: "level" });
    const session = new EditorSession(base, { initialPlaceId: "ground", initialToolbox: createToolboxState("buildings") });
    expect(session.executeTransaction({ id: "add-temporary", apply: () => withTemporary }).changed).toBe(true); session.openPlace("temporary");
    await act(async () => root.render(<Probe session={session} initialSelections={[{ kind: "place", id: "temporary" }]}/>));
    const undo = createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => session.getViewState().activePlaceId!, refresh: () => live.refresh() }).find(({ name }) => name === "undo_editor_change")!;
    await act(async () => { await undo.execute({}); });
    expect(live.ui.snapshot.activePlaceId).toBe("ground"); expect(live.ui.selections).toEqual([]);
    expect(live.ui.cutout).toBe(false); expect(live.ui.addOutline).toBe(false);
    expect(live.ui.expanded).toEqual(new Set(["ground", "building", "world"]));
    expect(live.ui.viewport).toEqual(viewportFor(base, "ground")); expect(live.ui.snapshot.toolbox.activeLayerId).toBe("construction");
    expect(storage.preference).toHaveBeenCalledWith("activePlaceId:project", "ground");
  });

  it("filters a deleted object without disturbing same-sheet editing modes", async () => {
    const project = projectWithEverySelection(); const session = new EditorSession(project, { initialPlaceId: "ground" });
    await act(async () => root.render(<Probe session={session} initialSelections={[{ kind: "element", id: "element" }]}/>));
    expect(session.executeTransaction({ id: "remove-element", apply: (current) => ({ ...current, elements: current.elements.filter(({ id }) => id !== "element") }) }).changed).toBe(true);
    await act(async () => live.refresh());
    expect(live.ui.snapshot.activePlaceId).toBe("ground"); expect(live.ui.selections).toEqual([]);
    expect(live.ui.cutout).toBe(true); expect(live.ui.addOutline).toBe(true); expect(storage.preference).not.toHaveBeenCalled();
  });

  it("uses the same reconciliation after a checkpoint restore", async () => {
    const checkpointProject = hierarchy(); const current = createPlace(checkpointProject, { id: "temporary", parentId: "building", name: "Temporary", kind: "level" });
    const session = new EditorSession(current, { initialPlaceId: "temporary" });
    storage.read.mockResolvedValue(createProjectCheckpoint(checkpointProject, { id: "checkpoint", name: "Earlier" }));
    await act(async () => root.render(<Probe session={session} initialSelections={[{ kind: "place", id: "temporary" }]}/>));
    await act(async () => { expect(await live.restore()).toBeTruthy(); });
    expect(storage.read).toHaveBeenCalledWith("checkpoint", "project"); expect(live.ui.snapshot.activePlaceId).toBe("ground");
    expect(live.ui.selections).toEqual([]); expect(live.ui.expanded).toEqual(new Set(["ground", "building", "world"]));
    expect(live.ui.viewport).toEqual(viewportFor(checkpointProject, "ground"));
  });
});
