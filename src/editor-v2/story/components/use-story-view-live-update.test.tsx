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
});
