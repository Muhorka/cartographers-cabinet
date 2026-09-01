import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { emptyStoryData } from "../types";
import { storyCopy } from "../i18n/story-copy";
import { StoryEntryConnections } from "./story-entry-connections";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows descriptive character relations but not canonical ownership facts", async () => {
  const hall = { kind: "place" as const, id: "hall" };
  const story = {
    ...emptyStoryData(),
    world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }],
    objects: [{ ref: hall, metadata: {} }],
    relations: [
      { id: "visit", from: { entryId: "anna" }, to: hall, kind: "visits" as const, description: "Only at dusk." },
      { id: "owner", from: { entryId: "anna" }, to: hall, kind: "owns" as const },
    ],
  };
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<StoryEntryConnections entry={{ id: "anna", name: "Anna" }} story={story} resolvedObjects={[{ ref: hall, name: "Hall" }]} copy={storyCopy.en}/>));
  expect(host.textContent).toContain("Anna — Visits → Hall");
  expect(host.textContent).not.toContain("Owns");
  expect(host.textContent).toContain("Only at dusk.");
  await act(async () => root.unmount()); host.remove();
});
