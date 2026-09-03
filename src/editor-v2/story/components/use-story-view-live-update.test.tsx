import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { emptyStoryData, type StoryData } from "../types";
import { useStoryView, type StoryDocumentUpdate } from "./use-story-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("live story collection updates", () => {
  it("applies two callbacks from one render to the latest document", async () => {
    const rendered: StoryData = { ...emptyStoryData(), world: [
      { id: "anna", kind: "character", name: "Anna", tags: [], properties: {} },
      { id: "bea", kind: "character", name: "Bea", tags: [], properties: {} },
    ] };
    let live = rendered; let controller!: ReturnType<typeof useStoryView>;
    const apply = (update: StoryDocumentUpdate) => { live = typeof update === "function" ? update(live) : update; };
    function Harness() { controller = useStoryView(rendered, apply); return null; }
    const host = document.createElement("div"); const root = createRoot(host);
    await act(async () => root.render(<Harness/>));
    await act(async () => {
      controller.updateCollection("characters", (items) => items.map((item) => item.id === "anna" ? { ...item, description: "First" } : item), "first");
      controller.updateCollection("characters", (items) => items.map((item) => item.id === "bea" ? { ...item, description: "Second" } : item), "second");
    });
    expect(live.world.map(({ id, description }) => ({ id, description }))).toEqual([{ id: "anna", description: "First" }, { id: "bea", description: "Second" }]);
    await act(async () => root.unmount());
  });

  it("merges two whole-collection edits from one render by record ID", async () => {
    const rendered: StoryData = { ...emptyStoryData(), lenses: [
      { id: "quiet", name: "Quiet", color: "#111111", expression: { kind: "all", items: [] } },
      { id: "bright", name: "Bright", color: "#222222", expression: { kind: "all", items: [] } },
    ] };
    let live = rendered; let controller!: ReturnType<typeof useStoryView>;
    const apply = (update: StoryDocumentUpdate) => { live = typeof update === "function" ? update(live) : update; };
    function Harness() { controller = useStoryView(rendered, apply); return null; }
    const host = document.createElement("div"); const root = createRoot(host);
    await act(async () => root.render(<Harness/>));
    await act(async () => {
      controller.editCollection("lenses", rendered.lenses.map((lens) => lens.id === "quiet" ? { ...lens, favorite: true } : lens), "favorite");
      controller.editCollection("lenses", rendered.lenses.map((lens) => lens.id === "bright" ? { ...lens, name: "Brighter" } : lens), "rename");
    });
    expect(live.lenses).toEqual([
      { ...rendered.lenses[0], favorite: true },
      { ...rendered.lenses[1], name: "Brighter" },
    ]);
    await act(async () => root.unmount());
  });
});
