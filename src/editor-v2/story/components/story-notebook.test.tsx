import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { StoryDocument } from "../types";
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
    const host = document.createElement("div"); const root = createRoot(host); const onDocumentsChange = vi.fn(async () => true); const onDocumentsDraftChange = vi.fn<(documents: StoryDocument[]) => boolean>(() => true);
    const documents = [{ id: "first", title: "First", bodyMarkdown: "", references: [] }, { id: "second", title: "Second", bodyMarkdown: "", references: [] }];
    await act(async () => root.render(<StoryNotebook open locale="en" documents={documents} objects={[]} scenarios={[]} onClose={vi.fn()} onDocumentsDraftChange={onDocumentsDraftChange} onDocumentsChange={onDocumentsChange} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>));
    const title = host.querySelector('input[aria-label="Note title"]')!;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "First draft"); title.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(onDocumentsDraftChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "first", title: "First draft" })]));
    expect(onDocumentsDraftChange.mock.calls.at(-1)?.[0].map((document: { id: string }) => document.id)).toEqual(["first", "second"]);
    await act(async () => { (Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Second") as HTMLButtonElement).click(); });
    expect(onDocumentsChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "first", title: "First draft" })]), "Save note");
    await act(async () => root.unmount());
  });

  it("offers retry for a failed autosave and retries the current draft", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    const host = document.createElement("div"); const root = createRoot(host);
    const onDocumentsChange = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    try {
      await act(async () => root.render(<StoryNotebook open locale="en" documents={[{ id: "note", title: "Scene", bodyMarkdown: "", references: [] }]} objects={[]} scenarios={[]} onClose={vi.fn()} onDocumentsDraftChange={vi.fn(() => true)} onDocumentsChange={onDocumentsChange} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>));
      const title = host.querySelector<HTMLInputElement>('input[aria-label="Note title"]')!;
      await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "Current draft"); title.dispatchEvent(new Event("input", { bubbles: true })); });
      await act(async () => { await vi.advanceTimersByTimeAsync(700); });

      expect(host.textContent).toContain("Save failed");
      const retry = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Retry save") as HTMLButtonElement | undefined;
      expect(retry).toBeTruthy();
      await act(async () => retry!.click());
      expect(onDocumentsChange).toHaveBeenCalledTimes(2);
      expect(onDocumentsChange.mock.calls[1]![0]).toEqual([expect.objectContaining({ id: "note", title: "Current draft" })]);
      expect(host.textContent).toContain("Saved");
    } finally {
      await act(async () => root.unmount());
      vi.useRealTimers();
      host.remove();
    }
  });

  it("ignores a second create action while the first save is pending", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div"); const root = createRoot(host);
    let resolveSave!: (saved: boolean) => void;
    const onDocumentsChange = vi.fn<(documents: StoryDocument[], label: string) => Promise<boolean>>(() => new Promise<boolean>((resolve) => { resolveSave = resolve; }));
    const onDocumentsDraftChange = vi.fn<(documents: StoryDocument[]) => boolean>(() => true);
    const documents = [{ id: "first", title: "First", bodyMarkdown: "", references: [] }];
    try {
      await act(async () => root.render(<StoryNotebook open locale="en" documents={documents} objects={[]} scenarios={[]} onClose={vi.fn()} onDocumentsDraftChange={onDocumentsDraftChange} onDocumentsChange={onDocumentsChange} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>));
      const create = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("New")) as HTMLButtonElement;
      await act(async () => { create.click(); create.click(); });
      expect(onDocumentsChange).toHaveBeenCalledTimes(1);
      expect(create.disabled).toBe(true);
      expect(host.querySelector("[inert]")).toBeTruthy();
      expect(onDocumentsChange.mock.calls[0]![0]).toHaveLength(2);

      const title = host.querySelector<HTMLInputElement>('input[aria-label="Note title"]')!;
      await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "Late edit"); title.dispatchEvent(new Event("input", { bubbles: true })); });
      expect(onDocumentsDraftChange).not.toHaveBeenCalled();

      await act(async () => { resolveSave(true); await Promise.resolve(); });
      expect(onDocumentsChange).toHaveBeenCalledTimes(1);
      expect(Array.from(host.querySelectorAll("button")).filter((button) => button.textContent === "New note")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("does not offer a storage retry for a draft rejected before persistence", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div"); const root = createRoot(host);
    try {
      await act(async () => root.render(<StoryNotebook open locale="en" documents={[{ id: "note", title: "Scene", bodyMarkdown: "", references: [] }]} objects={[]} scenarios={[]} onClose={vi.fn()} onDocumentsDraftChange={vi.fn(() => false)} onDocumentsChange={vi.fn(async () => true)} onFocus={vi.fn(() => true)} onScenario={vi.fn()}/>));
      const title = host.querySelector<HTMLInputElement>('input[aria-label="Note title"]')!;
      await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "Rejected draft"); title.dispatchEvent(new Event("input", { bubbles: true })); });

      expect(host.textContent).toContain("Save failed");
      expect(Array.from(host.querySelectorAll("button")).some((button) => button.textContent === "Retry save")).toBe(false);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
