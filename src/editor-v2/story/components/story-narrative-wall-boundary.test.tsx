import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { storyCopy } from "../i18n/story-copy";
import { emptyStoryData, type StoryObjectRef } from "../types";
import { StoryCreateEntry } from "./story-create-entry";
import { StoryInspector } from "./story-context-panel";
import { StoryIntentionEditor } from "./story-intention-editor";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wall: StoryObjectRef = { kind: "wall", id: "partition", scopeId: "ground-plan" };
const door: StoryObjectRef = { kind: "opening", id: "library-door", scopeId: "ground-plan" };
const story = {
  ...emptyStoryData(),
  objects: [
    { ref: wall, metadata: { narrativeLabel: "Partition wall" } },
    { ref: door, metadata: { narrativeLabel: "Library door" } },
  ],
};
const resolvedObjects = [
  { ref: wall, name: "Partition wall", metadata: story.objects[0]!.metadata },
  { ref: door, name: "Library door", metadata: story.objects[1]!.metadata },
];

describe("construction wall narrative boundary", () => {
  it("keeps walls out of relation and intention pickers while retaining doors", () => {
    const relation = renderToStaticMarkup(<StoryCreateEntry collection="relations" story={story} copy={storyCopy.en} resolvedObjects={resolvedObjects} onCreate={vi.fn()} onCancel={vi.fn()}/>);
    const intention = renderToStaticMarkup(<StoryCreateEntry collection="intentions" story={story} copy={storyCopy.en} resolvedObjects={resolvedObjects} onCreate={vi.fn()} onCancel={vi.fn()}/>);
    const intentionEditor = renderToStaticMarkup(<StoryIntentionEditor entry={{ id: "visit", name: "Visit", kind: "must-pass", text: "Visit", status: "draft" }} story={story} copy={storyCopy.en} resolvedObjects={resolvedObjects} onChange={vi.fn()}/>);

    for (const picker of [relation, intention, intentionEditor]) {
      expect(picker).not.toContain("Partition wall");
      expect(picker).toContain("Library door");
    }
  });

  it("still edits a selected wall directly through the inspector", async () => {
    const onMetadataChange = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(<StoryInspector story={story} selection={{ ref: wall, id: wall.id, kind: wall.kind, scopeId: wall.scopeId, name: "Partition wall" }} resolvedObjects={resolvedObjects} copy={storyCopy.en} onMetadataChange={onMetadataChange}/>));
      const nameField = [...host.querySelectorAll("label")].find((label) => label.querySelector("span")?.textContent === storyCopy.en.narrativeLabel)?.querySelector("input") as HTMLInputElement;
      expect(nameField).toBeDefined();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(nameField, "Named partition");
        nameField.dispatchEvent(new Event("input", { bubbles: true }));
      });
      const save = [...host.querySelectorAll("button")].find((button) => button.textContent === storyCopy.en.save) as HTMLButtonElement;
      expect(save).toBeDefined();
      await act(async () => save.click());
      expect(onMetadataChange).toHaveBeenCalledWith([wall], { narrativeLabel: "Named partition" }, "replace");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
