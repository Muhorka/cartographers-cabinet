import { act, createRef, forwardRef, useImperativeHandle } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { workbenchCopy } from "../i18n/workbench-copy";
import { useEditorDrawing } from "./use-editor-drawing";

type DrawingApi = ReturnType<typeof useEditorDrawing>;
let drawingRef: ReturnType<typeof createRef<DrawingApi>>;
let session: EditorSession;
let activePlaceId: string;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const Probe = forwardRef<DrawingApi, { session: EditorSession }>(function Probe({ session }, ref) {
  const drawing = useEditorDrawing({ session, snapshot: session.getViewState(), locale: "en", copy: workbenchCopy.en, refresh: () => undefined, onSelection: () => undefined });
  useImperativeHandle(ref, () => drawing, [drawing]);
  return null;
});

describe("drawing notice lifecycle", () => {
  beforeEach(() => {
    const project = createStarterProject("p", "Synthetic lifecycle", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    activePlaceId = level.id; session = new EditorSession(project, { initialPlaceId: activePlaceId });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host); drawingRef = createRef<DrawingApi>();
    act(() => root.render(<Probe ref={drawingRef} session={session}/>));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it("clears only blocked status while preserving draft and deferred continuation", () => {
    const drawing = drawingRef.current!; const beforeProject = structuredClone(session.getViewState().project);
    const blockedGesture = { instrumentId: "point" as const, points: [{ x: 1000, y: 1000 }] };
    act(() => drawing.applyGesture(blockedGesture, { activePlaceId, layerId: "equipment", subjectId: "equipment.marker", boundaryEditing: false, gesture: blockedGesture }));
    expect(drawingRef.current!.notice?.message).toBe(workbenchCopy.en.drawingStatus.blocked["outside-outline"]);
    const draft = { instrumentId: "polygon" as const, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
    act(() => drawingRef.current!.setGestureDraft(draft));
    let continued = false;
    act(() => drawingRef.current!.requestAfterDraft(() => { continued = true; }));
    expect(drawingRef.current!.canUndoDraft).toBe(true);
    act(() => drawingRef.current!.leaveDrawing());
    expect(drawingRef.current!.notice?.message).toBe(workbenchCopy.en.drawingStatus.unfinishedWithNavigation);
    expect(drawingRef.current!.gestureDraft).toEqual(draft);
    expect(session.getViewState().project).toEqual(beforeProject);
    const discard = drawingRef.current!.notice?.actions.find(({ label }) => label === workbenchCopy.en.drawingStatus.discard);
    expect(discard).toBeDefined();
    act(() => discard!.onClick());
    expect(continued).toBe(true);
    expect(drawingRef.current!.canUndoDraft).toBe(false);
    expect(drawingRef.current!.notice).toBeUndefined();
    expect(session.getViewState().project).toEqual(beforeProject);
  });
});
