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
  it("renders a character description below its name with the shared book-description style", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", description: "Keeper of the eastern archive", tags: [], properties: {} }] };
    function Harness() {
      const controller = useStoryView(story);
      return <StoryWorldbook story={story} copy={storyCopy.en} controller={controller}/>;
    }
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<Harness/>));
    const entry = [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.endsWith(": Anna"))!;
    expect(entry.className).toContain("worldbookEntry");
    expect(entry.children[0]).toMatchObject({ tagName: "STRONG", textContent: "Anna" });
    expect(entry.children[1]).toMatchObject({ tagName: "SMALL", textContent: "Keeper of the eastern archive" });
    expect((entry.children[1] as HTMLElement).className).toContain("worldbookEntryDescription");
    await act(async () => root.unmount()); host.remove();
  });

  it("groups worldbook collections by their narrative purpose", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "guards", kind: "access-group" as const, name: "Guards", tags: [], properties: {} }] };
    function Harness() {
      const controller = useStoryView(story);
      return <StoryWorldbook story={story} copy={storyCopy.en} controller={controller}/>;
    }
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<Harness/>));
    expect([...host.querySelectorAll("h3")].map((heading) => heading.textContent)).toEqual(["People", "World"]);
    const buttons = [...host.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons).toContain("Groups");
    expect(buttons).not.toContain("People groups");
    expect(buttons).not.toContain("Object groups");
    await act(async () => root.unmount()); host.remove();
  });

  it.each(["relations", "intentions"] as const)("creates %s targeting a room without pre-existing narrative metadata", async (collection) => {
    const room = { kind: "room" as const, id: "room", scopeId: "construction" };
    let latest: StoryData = { ...emptyStoryData(), world: [{ id: "anna", name: "Anna", kind: "character", tags: [], properties: {} }] };
    function Harness() {
      const [story, setStory] = useState(latest);
      const controller = useStoryView(story, (update) => { latest = storyDataSchema.parse(typeof update === "function" ? update(latest) : update); setStory(latest); });
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
