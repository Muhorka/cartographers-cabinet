import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyStoryData, defaultStoryAccessPolicy, type StoryAccessPolicy } from "../types";
import { storyCopy } from "../i18n/story-copy";
import { StoryAccessFields } from "./story-access-fields";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(value: StoryAccessPolicy = { ...defaultStoryAccessPolicy(), permission: "nobody", hidden: true, knownBy: ["staff"] }) {
  const story = emptyStoryData();
  story.world = [
    { id: "anna", kind: "character", name: "Anna", tags: [], properties: {} },
    { id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} },
    { id: "key", kind: "key", name: "Key", tags: [], properties: {} },
  ];
  const onChange = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  act(() => root.render(<StoryAccessFields story={story} copy={storyCopy.pl} value={value} passage dirty={false} onChange={onChange}/>));
  const rerender = (nextValue: StoryAccessPolicy) => act(() => root.render(<StoryAccessFields story={story} copy={storyCopy.pl} value={nextValue} passage dirty={false} onChange={onChange}/>));
  return { host, root, onChange, rerender };
}

describe("StoryAccessFields", () => {
  it("shows peer access details and the explicit nobody/hidden-by-actors controls", () => {
    const view = render();
    expect([...view.host.querySelectorAll("summary")].map((item) => item.textContent)).toEqual(["Kto może tu wejść?", "Stan przejścia", "Klucze: Brak przypisanego klucza", "Wyjątki i dodatkowe ograniczenia"]);
    expect(view.host.textContent).toContain("Nikt"); expect(view.host.textContent).toContain("Ukryj przejście przed trasami postaci");
    expect(view.host.textContent).toContain("Kto wie, że ono istnieje?"); expect(view.host.textContent).toContain("Anna"); expect(view.host.textContent).toContain("Staff");
    expect((view.host.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    const passage = [...view.host.querySelectorAll("details")].find((item) => item.querySelector("summary")?.textContent === "Stan przejścia");
    const access = [...view.host.querySelectorAll("details")].find((item) => item.querySelector("summary")?.textContent === "Kto może tu wejść?");
    expect(passage?.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(access?.querySelector('input[type="checkbox"]')).toBeNull();
    view.root.unmount(); view.host.remove();
  });

  it("writes nobody and hidden changes without touching the other access fields", () => {
    const view = render({ ...defaultStoryAccessPolicy(), permission: "open", physicalState: "closed", lock: "locked", hidden: false });
    const selects = [...view.host.querySelectorAll("select")];
    act(() => { (selects[0] as HTMLSelectElement).value = "nobody"; selects[0]!.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(view.onChange).toHaveBeenCalledWith({ permission: "nobody" });
    const hidden = view.host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => { hidden.click(); });
    expect(view.onChange).toHaveBeenLastCalledWith({ hidden: true });
    view.root.unmount(); view.host.remove();
  });

  it("opens keys by default for a locked passage and preserves a manual collapse", () => {
    const value = { ...defaultStoryAccessPolicy(), lock: "locked" as const, keyIds: ["key"] };
    const view = render(value);
    const details = [...view.host.querySelectorAll("details")].find((item) => item.querySelector("summary")?.textContent === "Klucze: 1 przypisany klucz") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    act(() => { details.open = false; details.dispatchEvent(new Event("toggle", { bubbles: true })); });
    expect(details.open).toBe(false);
    view.rerender({ ...value, physicalState: "closed" });
    expect(details.open).toBe(false);
    view.root.unmount(); view.host.remove();
  });
});
