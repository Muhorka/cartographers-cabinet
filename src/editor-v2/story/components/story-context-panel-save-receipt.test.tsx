import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyStoryData } from "../types";
import { storyCopy } from "../i18n/story-copy";
import { StoryInspector } from "./story-context-panel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];
afterEach(() => { for (const { root, host } of mounted.splice(0)) { act(() => root.unmount()); host.remove(); } });

function mount(onMetadataChange: (...args: Parameters<NonNullable<ComponentProps<typeof StoryInspector>["onMetadataChange"]>>) => boolean | void) {
  const target = { kind: "place" as const, id: "hall" };
  const story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }], propertyDefinitions: [{ id: "flag", name: "Flag", type: "boolean" as const }, { id: "count", name: "Count", type: "number" as const }], objects: [{ ref: target, metadata: { owners: ["anna"], properties: { flag: false, count: 0 } } }] };
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); mounted.push({ root, host });
  act(() => root.render(<StoryInspector story={story} selection={{ id: target.id, kind: target.kind }} copy={storyCopy.en} detailsOpen onMetadataChange={onMetadataChange} />));
  return { host };
}

function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Story context metadata save receipt", () => {
  it("keeps the draft after an explicit failed receipt, including false, zero and empty values", () => {
    const onMetadataChange = vi.fn(() => false); const { host } = mount(onMetadataChange);
    const flag = [...host.querySelectorAll("label")].find((item) => item.textContent?.includes("Flag"))!.querySelector("input") as HTMLInputElement; const count = host.querySelector('input[type="number"]') as HTMLInputElement; const description = host.querySelector("textarea") as HTMLTextAreaElement;
    act(() => flag.click()); act(() => setValue(count, "1")); act(() => setValue(count, "0")); act(() => setValue(description, "draft")); act(() => setValue(description, ""));
    const save = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save") as HTMLButtonElement; act(() => save.click());
    expect(onMetadataChange).toHaveBeenCalledWith([{ kind: "place", id: "hall" }], { narrativeDescription: "", properties: { flag: true, count: 0 } }, "replace");
    expect(host.textContent).toContain("Unsaved changes");
  });

  it("clears the save bar only after a successful receipt and still forwards an explicit empty owner list", () => {
    const onMetadataChange = vi.fn(() => true); const { host } = mount(onMetadataChange);
    const owner = [...host.querySelectorAll("label")].find((item) => item.textContent?.includes("Anna"))!.querySelector("input") as HTMLInputElement; act(() => owner.click());
    expect(host.textContent).toContain("Unsaved changes");
    const save = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save") as HTMLButtonElement; act(() => save.click());
    expect(onMetadataChange).toHaveBeenCalledWith([{ kind: "place", id: "hall" }], { owners: [] }, "replace");
    expect(host.textContent).not.toContain("Unsaved changes");
  });

  it("renders effective custom owners without re-adding the inherited owner and protects reset from draft loss", () => {
    const target = { kind: "place" as const, id: "hall" };
    const story = { ...emptyStoryData(), world: [
      { id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} },
      { id: "ewa", kind: "character" as const, name: "Ewa", tags: [], properties: {} },
      { id: "adam", kind: "character" as const, name: "Adam", tags: [], properties: {} },
    ], objects: [{ ref: target, metadata: { owners: ["ewa", "adam"] } }] };
    const onResetOwnership = vi.fn(() => true); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); mounted.push({ root, host });
    act(() => root.render(<StoryInspector story={story} selection={{ id: target.id, kind: target.kind }} copy={storyCopy.en} detailsOpen onResetOwnership={onResetOwnership} canResetOwnership ownership={{ mode: "custom", effectiveOwners: ["ewa", "adam"], directOwners: ["ewa", "adam"], inheritedOwners: ["anna"], directPresent: true, inheritedPresent: true, directSource: { kind: "local" }, inheritedSource: { kind: "inherited", name: "Anna" } }} />));
    const checkbox = (name: string) => [...host.querySelectorAll("label")].find((item) => item.textContent === name)!.querySelector("input") as HTMLInputElement;
    expect(checkbox("Anna").checked).toBe(false); expect(checkbox("Ewa").checked).toBe(true); expect(checkbox("Adam").checked).toBe(true);
    const reset = [...host.querySelectorAll("button")].find((button) => button.textContent === "Restore inheritance") as HTMLButtonElement; expect(reset.disabled).toBe(false);
    const description = host.querySelector("textarea") as HTMLTextAreaElement; act(() => setValue(description, "draft")); expect(reset.disabled).toBe(true); act(() => reset.click()); expect(onResetOwnership).not.toHaveBeenCalled();
  });

});
