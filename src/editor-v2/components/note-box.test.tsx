import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createStarterProject } from "../model/starter-project";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";
import { resizeElementRegion } from "../drawing/selection-operations";
import { ElementShape, wrapNoteText } from "./map-sheet-shapes";

const note = (geometry: { kind: "note"; at: { x: number; y: number }; text: string; width?: number; height?: number; rotation?: number }) => ({ id: "note", belongsToId: "project:world", name: "Note", layerId: "sketch" as const, subjectId: "sketch.note", geometry, visible: true, locked: false, tags: [], access: [], properties: {} });

describe("note boxes", () => {
  it("wraps words to the box width and renders no overflowing lines", () => {
    const lines = wrapNoteText("A long note with several words", 20, 5);
    expect(lines.every((line) => line.length <= Math.floor(20 / (5 * .58)))).toBe(true);
    const html = renderToStaticMarkup(<svg><ElementShape element={note({ kind: "note", at: { x: 1, y: 2 }, text: "A long note with several words", width: 20, height: 10 })} prefix="test" viewportZoom={1} pointRadius={5} resizeHandleSize={1} opacity={1} selectable={false} showResizeHandles={false} selected={false}/></svg>);
    expect(html).toContain("noteBox"); expect(html).toContain("<tspan"); expect(html).toContain("…");
  });

  it("rotates the note box and inline text together", () => {
    const html = renderToStaticMarkup(<svg><ElementShape element={note({ kind: "note", at: { x: 1, y: 2 }, text: "Rotated", width: 20, height: 10, rotation: 37 })} prefix="test" viewportZoom={1} pointRadius={5} resizeHandleSize={1} opacity={1} selectable={false} showResizeHandles={false} selected={false}/></svg>);
    expect(html).toContain('transform="rotate(37 1 2)"'); expect(html).toContain("noteBox");
  });

  it("validates new note box dimensions while retaining legacy notes", () => {
    const project = createStarterProject("project", "Project", "en");
    const modern = { ...project, elements: [note({ kind: "note", at: { x: 1, y: 2 }, text: "boxed", width: 12, height: 8 })] };
    expect(parseProjectFile(serializeProjectFile(modern)).project.elements[0].geometry).toMatchObject({ width: 12, height: 8 });
    const legacy = { ...project, elements: [note({ kind: "note", at: { x: 1, y: 2 }, text: "old" })] };
    expect(parseProjectFile(serializeProjectFile(legacy)).project.elements[0].geometry).toMatchObject({ kind: "note", text: "old" });
  });

  it("resizes the note box without losing its text", () => {
    const project = createStarterProject("project", "Project", "en");
    const result = resizeElementRegion({ ...project, elements: [note({ kind: "note", at: { x: 2, y: 3 }, text: "keep", width: 10, height: 6 })] }, "note", "north-west", { x: 0, y: 1 });
    expect(result.state).toBe("applied"); if (result.state === "applied") expect(result.project.elements[0].geometry).toMatchObject({ at: { x: 0, y: 1 }, width: 12, height: 8, text: "keep" });
  });

  it("resizes a rotated note in local coordinates while preserving the opposite corner", () => {
    const source = note({ kind: "note", at: { x: 10, y: 20 }, text: "keep", width: 10, height: 4, rotation: 90 });
    const project = createStarterProject("project", "Project", "en");
    const beforeOpposite = { x: 6, y: 20 };
    const result = resizeElementRegion({ ...project, elements: [source] }, "note", "north-east", { x: 13, y: 26 });
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const geometry = result.project.elements[0].geometry;
    expect(geometry).toMatchObject({ kind: "note", width: 6, height: 7, rotation: 90 });
    if (geometry.kind !== "note") return;
    expect(geometry.at.x).toBeCloseTo(13); expect(geometry.at.y).toBeCloseTo(20);
    const radians = Math.PI / 2; const height = geometry.height!; const opposite = { x: geometry.at.x - Math.sin(radians) * height, y: geometry.at.y + Math.cos(radians) * height };
    expect(opposite.x).toBeCloseTo(beforeOpposite.x); expect(opposite.y).toBeCloseTo(beforeOpposite.y);
  });

  it("opens inline editing and isolates typing from the map", () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); const onChange = (id: string, text: string) => calls.push([id, text]); const calls: string[][] = [];
    act(() => root.render(<svg><ElementShape element={note({ kind: "note", at: { x: 1, y: 2 }, text: "Example", width: 30, height: 10 })} prefix="test" viewportZoom={1} pointRadius={5} resizeHandleSize={1} opacity={1} selectable showResizeHandles={false} selected={false} onNoteTextChange={onChange}/></svg>));
    const text = container.querySelector("text")!; act(() => text.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const textarea = container.querySelector("textarea")!;
    setNativeValue(textarea, "Edited"); act(() => { textarea.dispatchEvent(new Event("input", { bubbles: true })); textarea.dispatchEvent(new Event("change", { bubbles: true })); }); act(() => textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
    expect(container.querySelector("textarea")).toBeTruthy();
    act(() => root.unmount()); container.remove();
  });
});

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; setter?.call(element, value);
}
