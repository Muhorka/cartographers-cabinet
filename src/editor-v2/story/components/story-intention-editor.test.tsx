import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyStoryData, type StoryObjectRef } from "../types";
import { storyCopy } from "../i18n/story-copy";
import type { StoryRecord } from "./story-types";
import { StoryIntentionEditor } from "./story-intention-editor";

const subject: StoryObjectRef = { kind: "place", id: "hall" };
const target: StoryObjectRef = { kind: "place", id: "archive" };
const door: StoryObjectRef = { kind: "opening", id: "door" };

function fixture(entry: StoryRecord = { id: "goal", name: "Reach", kind: "reachability", subjectRef: "place::hall", targetRef: "place::archive", text: "Reach the archive", status: "draft", throughRefs: ["opening::door"], avoidZoneId: "forbidden", accessEntryId: "secret-key" }) {
  return { ...emptyStoryData(), objects: [{ ref: subject, metadata: {} }, { ref: target, metadata: {} }, { ref: door, metadata: { narrativeLabel: "North door" } }], zones: [{ id: "forbidden", name: "Forbidden garden", members: [], tags: [] }], world: [{ id: "alice", kind: "character" as const, name: "Alice", tags: [], properties: {} }, { id: "guild", kind: "faction" as const, name: "Guild", tags: [], properties: {} }, { id: "guards", kind: "access-group" as const, name: "Guards", tags: [], properties: {} }, { id: "secret-key", kind: "key" as const, name: "Secret key", tags: [], properties: {} }], entry, resolvedObjects: [{ ref: subject, name: "Great hall" }, { ref: target, name: "Archive" }, { ref: door, name: "North door" }] };
}

function render(entry?: StoryRecord) {
  const data = fixture(entry); const onChange = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  act(() => root.render(<StoryIntentionEditor entry={data.entry} story={data} resolvedObjects={data.resolvedObjects} copy={storyCopy.pl} onChange={onChange}/>));
  return { host, root, onChange };
}

describe("StoryIntentionEditor", () => {
  it("shows only fields for the selected goal and preserves omitted record fields when kind changes", () => {
    const view = render();
    expect(view.host.textContent).toContain("Dokąd ma prowadzić?"); expect(view.host.textContent).not.toContain("Jakiej strefy ma unikać?");
    const select = [...view.host.querySelectorAll("select")].find((item) => item.value === "reachability")!;
    act(() => { select.value = "must-pass"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const next = view.onChange.mock.lastCall?.[0] as StoryRecord;
    expect(next).toMatchObject({ kind: "must-pass", avoidZoneId: "forbidden", accessEntryId: "secret-key", throughRefs: ["opening::door"] });
    view.root.unmount(); view.host.remove();
  });

  it("uses named object references and never offers keys as access actors", () => {
    const view = render({ id: "access", name: "Access", kind: "access-rule", subjectRef: "opening::door", accessEntryId: "guards", text: "Guards may enter", status: "draft" });
    expect(view.host.textContent).toContain("North door"); expect(view.host.textContent).toContain("Guards");
    const actor = [...view.host.querySelectorAll("select")].find((item) => item.value === "guards")!;
    const labels = [...actor.options].map((option) => option.textContent);
    expect(labels).toEqual(["Wybierz…", "Alice", "Guild", "Guards"]);
    expect(labels).not.toContain("Secret key");
    view.root.unmount(); view.host.remove();
  });
});
