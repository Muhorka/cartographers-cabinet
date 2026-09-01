import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { updateNoteText } from "../drawing/note-text";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";
import { workbenchCopy } from "../i18n/workbench-copy";
import { InspectorPanel } from "./inspector-panel";
import { MapSheet } from "./map-sheet";

describe("note editing on the sheet and in the inspector", () => {
  it("saves every input, synchronizes both fields, survives leaving and preserves undo", () => {
    const project = createStarterProject("p", "Test", "pl");
    project.elements = [{ id: "n", name: "Notatka", belongsToId: "p:world", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, width: 90, height: 40, text: "Przykład" }, visible: true, locked: false, tags: [], access: [], properties: {} }];
    const session = new EditorSession(project, { initialPlaceId: "p:world" });
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container); const gesture = vi.fn();
    const copy = workbenchCopy.pl;
    const render = () => root.render(<>
      <MapSheet project={session.getState().project} activePlaceId="p:world" viewport={{ center: { x: 0, y: 0 }, zoom: 2, rotation: 0 }} copy={copy.map} interaction={{ enabled: true, instrumentId: "note" }} onNoteTextChange={change} onGesture={gesture}/>
      <InspectorPanel project={session.getState().project} activePlaceId="p:world" selections={[{ kind: "element", id: "n" }]} copy={copy} onNoteTextChange={change} onUpdateElement={vi.fn()} onUpdatePlace={vi.fn()} onResizeOpening={vi.fn()} onDeletePlace={vi.fn()} onAddLevel={vi.fn()} onReparentPlace={vi.fn()} onSelect={vi.fn()}/>
      <button>Poza notatką</button>
    </>);
    function change(id: string, text: string) {
      session.executeTransaction({ id: "note-text", apply: (current) => updateNoteText(current, id, text) });
      render();
    }
    const text = () => { const geometry = session.getState().project.elements[0].geometry; return geometry.kind === "note" ? geometry.text : ""; };
    act(render);
    act(() => container.querySelector('[data-note-editor]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const inline = container.querySelector("svg textarea") as HTMLTextAreaElement;
    expect(inline).toBeTruthy();
    type(inline, "Pierwsza linia\nDruga linia");
    expect(text()).toBe("Pierwsza linia\nDruga linia");
    expect(container.querySelector("svg textarea")).toBe(inline);
    const inspector = [...container.querySelectorAll("textarea")].find((field) => !field.closest("svg"))!;
    expect(inspector.value).toBe(text());
    type(inspector, "Poprawiona treść");
    expect(text()).toBe("Poprawiona treść");
    expect(inline.value).toBe(text());
    act(() => inline.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
    expect(gesture).not.toHaveBeenCalled();
    act(() => container.querySelector("button")!.click());
    expect(text()).toBe("Poprawiona treść");
    const restored = parseProjectFile(serializeProjectFile(session.getState().project)).project;
    expect(restored.elements[0].geometry).toMatchObject({ text: "Poprawiona treść", width: 90, height: 40 });
    act(() => { session.undo(); render(); });
    expect(inspector.value).toBe("Pierwsza linia\nDruga linia");
    act(() => root.unmount()); container.remove();
  });
});

function type(field: HTMLTextAreaElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
