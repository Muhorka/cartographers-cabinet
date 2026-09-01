import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { emptyStoryData, storyRefKey, type StoryData } from "../types";
import { storyDataSchema } from "../schema";
import { storyCopy } from "../i18n/story-copy";
import { StoryWorldbook } from "./story-worldbook";
import { useStoryView } from "./use-story-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("worldbook creation uses the same live object catalogue as editing", () => {
  it.each(["relations", "intentions"] as const)("creates %s targeting a room without pre-existing narrative metadata", async (collection) => {
    const room = { kind: "room" as const, id: "room", scopeId: "construction" };
    let latest: StoryData = { ...emptyStoryData(), world: [{ id: "anna", name: "Anna", kind: "character", tags: [], properties: {} }] };
    function Harness() {
      const [story, setStory] = useState(latest);
      const controller = useStoryView(story, (next) => { latest = storyDataSchema.parse(next); setStory(latest); });
      return <StoryWorldbook story={story} copy={storyCopy.en} controller={controller} resolvedObjects={[{ ref: room, name: "Hall" }]}/>;
    }
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<Harness/>));
    const button = (name: string) => [...host.querySelectorAll("button")].find((element) => element.textContent === name)!;
    await act(async () => button(collection === "relations" ? "Relations" : "Intentions").click());
    await act(async () => button(collection === "relations" ? "Add relation" : "Add author intention").click());
    const name = host.querySelector("#story-new-entry") as HTMLInputElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "The hall"); name.dispatchEvent(new Event("input", { bubbles: true })); });
    async function select(label: string, value: string) {
      await act(async () => { const element = host.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
    }
    if (collection === "relations") { await select("From", "entryId:anna"); await select("To", storyRefKey(room)); }
    else await select("Which object does this concern?", storyRefKey(room));
    await act(async () => button(collection === "relations" ? "Create relation" : "Create intention").click());
    if (collection === "relations") expect(latest.relations[0]).toMatchObject({ from: { entryId: "anna" }, to: room });
    else expect(latest.intentions[0]).toMatchObject({ subject: room, text: "The hall" });
    expect(latest.objects).toEqual([]);
    await act(async () => root.unmount()); host.remove();
  });
});
