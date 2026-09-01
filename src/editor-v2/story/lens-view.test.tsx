import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { activeStoryLensIds, patchStoryLensView, visibleStoryLenses, type StoryLensView } from "./lens-view";
import { emptyStoryData, type StoryLens } from "./types";
import { useStoryView } from "./components/use-story-view";

const lens: StoryLens = { id: "saved", name: "Quiet", color: "#704030", expression: { kind: "predicate", predicate: { kind: "tag", value: "quiet" } } };

it("keeps multiple lenses, a legacy replacement, and preview as independent view settings", () => {
  let view: StoryLensView = patchStoryLensView({}, { activeLensIds: ["first", "second", "first"], previewLens: lens });
  expect(activeStoryLensIds(view)).toEqual(["first", "second"]);
  expect(view.activeLensId).toBe("first");
  view = patchStoryLensView(view, { activeLensId: "third" });
  expect(activeStoryLensIds(view)).toEqual(["third"]);
  expect(view.previewLens).toEqual(lens);
  view = patchStoryLensView(view, { activeLensId: undefined });
  expect(activeStoryLensIds(view)).toEqual([]);
  expect(view.previewLens).toEqual(lens);
});

it("drops deleted saved ids from rendering and does not overwrite a saved lens with its preview", () => {
  const preview = { ...lens, color: "#123456" };
  const selected = visibleStoryLenses([lens], { activeLensIds: ["saved", "missing"], previewLens: preview });
  expect(selected).toEqual([lens, preview]);
  expect(lens.color).toBe("#704030");
});

it("does not save view changes and does not carry a draft into a different project", async () => {
  const story = { ...emptyStoryData(), lenses: [lens] }; const original = structuredClone(story);
  const save = vi.fn(); let controller!: ReturnType<typeof useStoryView>;
  function Harness({ scope }: { scope: string }) { controller = useStoryView(story, save, [], scope); return null; }
  const host = document.createElement("div"); const root = createRoot(host);
  await act(async () => root.render(<Harness scope="one"/>));
  await act(async () => controller.updateView({ activeLensIds: ["saved"], previewLens: lens }));
  expect(controller.view.previewLens).toEqual(lens);
  expect(save).not.toHaveBeenCalled(); expect(story).toEqual(original);
  await act(async () => root.render(<Harness scope="two"/>));
  expect(activeStoryLensIds(controller.view)).toEqual([]); expect(controller.view.previewLens).toBeUndefined();
  await act(async () => controller.updateView({ activeLensIds: ["saved"] }));
  expect(controller.view.previewLens).toBeUndefined(); expect(save).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
