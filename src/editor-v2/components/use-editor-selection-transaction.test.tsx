import { act, createRef, forwardRef, useImperativeHandle } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { createConstructionDocument } from "../construction/construction-document";
import { EditorSession } from "../state/editor-session";
import { workbenchCopy } from "../i18n/workbench-copy";
import { useEditorSelection } from "./use-editor-selection";
import type { EditableSelection } from "../drawing/selection-operations";

type SelectionApi = ReturnType<typeof useEditorSelection>;
let apiRef: ReturnType<typeof createRef<SelectionApi>>;
let session: EditorSession;
let selected: EditableSelection[];
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const Probe = forwardRef<SelectionApi, { session: EditorSession }>(function Probe({ session }, ref) {
  const api = useEditorSelection({ session, snapshot: session.getViewState(), locale: "en", copy: workbenchCopy.en, refresh: () => undefined, onSelection: (selection) => { selected = selection ? [selection] : []; }, onSelections: (selections) => { selected = selections; } });
  useImperativeHandle(ref, () => api, [api]);
  return null;
});

describe("selection transaction rejection", () => {
  beforeEach(() => {
    const project = createStarterProject("p", "Selection transaction", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    project.elements.push({ id: "marker", belongsToId: level.id, name: "Marker", layerId: "equipment", subjectId: "equipment.marker", geometry: { kind: "point", at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    session = new EditorSession(project, { initialPlaceId: level.id }); selected = [{ kind: "element", id: "marker" }];
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host); apiRef = createRef<SelectionApi>();
    act(() => root.render(<Probe ref={apiRef} session={session}/>));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

  it("does not select a duplicate that the central transaction refused", () => {
    vi.spyOn(session, "executeTransaction").mockReturnValueOnce({ code: "transaction-failed", changed: false, reason: "Synthetic rejection" });
    act(() => apiRef.current!.duplicateElements(["marker"]));
    expect(selected).toEqual([{ kind: "element", id: "marker" }]);
    expect(apiRef.current!.notice?.message).toBe(workbenchCopy.en.editingStatus.blocked["transaction-failed"]);
  });

  it("does not apply a room review after another transaction changed the session", () => {
    const project = createStarterProject("review", "Selection review", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const base = project.constructions.find(({ id }) => id === level.constructionId)!;
    let roomSequence = 0;
    const document = createConstructionDocument(base.id, [...base.walls, { id: "partition", start: { x: 0, y: -11 }, end: { x: 0, y: 11 }, thickness: .2, role: "partition" }], { createId: () => `review-id-${++roomSequence}`, createName: (index) => `Room ${index}` });
    session = new EditorSession({ ...project, constructions: [document] }, { initialPlaceId: level.id });
    act(() => root.render(<Probe ref={apiRef} session={session}/>));
    const room = session.getState().project.constructions[0].rooms[0];

    act(() => apiRef.current!.remove({ kind: "room", id: room.id }));
    expect(apiRef.current!.notice?.actions.find(({ id }) => id === "apply")).toBeDefined();
    session.executeTransaction({ id: "newer", apply: (current) => ({ ...current, name: "Newer work" }) });
    act(() => apiRef.current!.notice?.actions.find(({ id }) => id === "apply")?.onClick());

    expect(session.getState().project.name).toBe("Newer work");
    expect(session.getState().project.constructions[0].walls.map(({ id }) => id)).toContain("partition");
    expect(apiRef.current!.notice?.message).toBe(workbenchCopy.en.editingStatus.blocked["transaction-failed"]);
  });
});
