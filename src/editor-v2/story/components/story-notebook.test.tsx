import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoryNotebook, StoryNotebookToggle } from "./story-notebook";

describe("StoryNotebook", () => {
  it("offers the inkwell toggle in both languages", () => {
    expect(renderToStaticMarkup(<StoryNotebookToggle open={false} locale="pl" onClick={vi.fn()}/>)).toContain("Otwórz notatnik autora");
    expect(renderToStaticMarkup(<StoryNotebookToggle open locale="en" onClick={vi.fn()}/>)).toContain("Fold the writer&#x27;s notebook");
  });

  it("renders an existing note with object and scenario references", () => {
    const html = renderToStaticMarkup(<StoryNotebook open locale="en" documents={[{ id: "note", title: "Arrival", bodyMarkdown: "First line", references: [{ kind: "object", ref: { kind: "place", id: "hall" } }, { kind: "scenario", scenarioId: "night" }] }]} objects={[{ ref: { kind: "place", id: "hall" }, name: "Great Hall" }]} scenarios={[{ id: "night", name: "Night", patches: [], steps: [] }]} onClose={vi.fn()} onDocumentsDraftChange={vi.fn(() => true)} onDocumentsChange={vi.fn(async () => true)} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>);
    expect(html).toContain("Arrival");
    expect(html).toContain("Great Hall");
    expect(html).toContain("Night");
  });

  it("renders stored Markdown as formatted text in the client editor", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div"); const root = createRoot(host);
    await act(async () => root.render(<StoryNotebook open locale="en" documents={[{ id: "note", title: "Scene", bodyMarkdown: "**Bold** and _italic_", references: [] }]} objects={[]} scenarios={[]} onClose={vi.fn()} onDocumentsDraftChange={vi.fn(() => true)} onDocumentsChange={vi.fn(async () => true)} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>));
    expect(host.querySelector("strong")?.textContent).toBe("Bold");
    expect(host.querySelector("em")?.textContent).toBe("italic");
    expect(host.querySelector('[contenteditable="true"]')?.textContent).not.toContain("**");
    expect(host.querySelector('[aria-label="Normal text"]')).toBeTruthy();
    expect(host.querySelector('[aria-label="Clear formatting"]')).toBeTruthy();
    await act(async () => root.unmount());
  });

  it("saves an unfinished draft before opening another note", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div"); const root = createRoot(host); const onDocumentsChange = vi.fn(async () => true); const onDocumentsDraftChange = vi.fn(() => true);
    const documents = [{ id: "first", title: "First", bodyMarkdown: "", references: [] }, { id: "second", title: "Second", bodyMarkdown: "", references: [] }];
    await act(async () => root.render(<StoryNotebook open locale="en" documents={documents} objects={[]} scenarios={[]} onClose={vi.fn()} onDocumentsDraftChange={onDocumentsDraftChange} onDocumentsChange={onDocumentsChange} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>));
    const title = host.querySelector('input[aria-label="Note title"]')!;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "First draft"); title.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(onDocumentsDraftChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "first", title: "First draft" })]));
    await act(async () => { (Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Second") as HTMLButtonElement).click(); });
    expect(onDocumentsChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "first", title: "First draft" })]), "Save note");
    await act(async () => root.unmount());
  });
});
