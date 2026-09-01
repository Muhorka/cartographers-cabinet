import { act, createRef, forwardRef, useImperativeHandle } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
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
});
