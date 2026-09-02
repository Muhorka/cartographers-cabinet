import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { emptyStoryData } from "../types";
import { storyCopy } from "../i18n/story-copy";
import { StoryLenses } from "./story-lenses";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { host, root };
}

describe("StoryLenses", () => {
  it("previews the local draft without writing a saved lens", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }] };
    const onChange = vi.fn();
    const onPreview = vi.fn();
    const { host, root } = mount(<StoryLenses story={story} copy={storyCopy.en} lenses={[]} onSelect={vi.fn()} onChange={onChange} onPreview={onPreview}/>);
    const selects = host.querySelectorAll("select");
    await act(async () => { (selects[1] as HTMLSelectElement).value = "anna"; selects[1].dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => (host.querySelector('button:not(:disabled)[class*="addCondition"]') as HTMLButtonElement).click());
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Show on map")?.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: "temporary-lens", name: "Temporary filter", color: "#9d3f35", expression: { kind: "all", items: [{ kind: "predicate", predicate: { kind: "owner", entryId: "anna" } }] } }));
    act(() => root.unmount());
    host.remove();
  });

  it("does not seed a new filter from the active saved lens", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }] };
    const lens = { id: "lens", name: "Anna's places", color: "#123456", expression: { kind: "all" as const, items: [{ kind: "predicate" as const, predicate: { kind: "owner" as const, entryId: "anna" } }] } };
    const onPreview = vi.fn();
    const render = (activeLensIds: string[]) => <StoryLenses story={story} copy={storyCopy.en} lenses={[lens]} activeLensIds={activeLensIds} onSelect={vi.fn()} onChange={vi.fn()} onPreview={onPreview}/>;
    const { host, root } = mount(render(["lens"]));
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Show on map")?.disabled).toBe(true);
    act(() => root.render(render([])));
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Show on map")?.disabled).toBe(true);
    expect(onPreview).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });

  it("keeps the new-filter draft separate while a saved lens is edited", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }] };
    const lens = { id: "lens", name: "Quiet", color: "#123456", expression: { kind: "all" as const, items: [] } };
    const onPreview = vi.fn();
    const { host, root } = mount(<StoryLenses story={story} copy={storyCopy.en} lenses={[lens]} onSelect={vi.fn()} onChange={vi.fn()} onPreview={onPreview}/>);
    const selects = host.querySelectorAll("select");
    await act(async () => { (selects[1] as HTMLSelectElement).value = "anna"; selects[1].dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => (host.querySelector('button:not(:disabled)[class*="addCondition"]') as HTMLButtonElement).click());
    await act(async () => (host.querySelector('button[title="Edit"]') as HTMLButtonElement).click());
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Cancel")?.click());
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Show on map")?.click());
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ expression: { kind: "all", items: [{ kind: "predicate", predicate: { kind: "owner", entryId: "anna" } }] } }));
    act(() => root.unmount());
    host.remove();
  });

  it("keeps an unsaved edit local when cancelled", async () => {
    const lens = { id: "lens", name: "Quiet", color: "#123456", expression: { kind: "all" as const, items: [] } };
    const onChange = vi.fn();
    const { host, root } = mount(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={[lens]} onSelect={vi.fn()} onChange={onChange}/>);
    await act(async () => (host.querySelector('button[title="Edit"]') as HTMLButtonElement).click());
    const color = host.querySelector('input[type="color"]') as HTMLInputElement;
    await act(async () => { color.value = "#abcdef"; color.dispatchEvent(new Event("input", { bubbles: true })); color.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Cancel")?.click());
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => (host.querySelector('button[title="Edit"]') as HTMLButtonElement).click());
    expect((host.querySelector('input[type="color"]') as HTMLInputElement).value).toBe("#123456");
    act(() => root.unmount());
    host.remove();
  });

  it("saves an edited color only after explicit confirmation", async () => {
    const lens = { id: "lens", name: "Quiet", color: "#123456", expression: { kind: "all" as const, items: [] } };
    const onChange = vi.fn();
    const { host, root } = mount(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={[lens]} onSelect={vi.fn()} onChange={onChange}/>);
    await act(async () => (host.querySelector('button[title="Edit"]') as HTMLButtonElement).click());
    const saveButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save changes") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    const color = host.querySelector('input[type="color"]') as HTMLInputElement;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(color, "#abcdef"); color.dispatchEvent(new Event("input", { bubbles: true })); color.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(onChange).not.toHaveBeenCalled();
    expect(saveButton.disabled).toBe(false);
    await act(async () => saveButton.click());
    expect(onChange).toHaveBeenCalledWith([{ ...lens, color: "#abcdef" }]);
    expect(saveButton.disabled).toBe(true);
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe("Changes saved.");
    act(() => root.unmount());
    host.remove();
  });

  it("edits and deletes a saved lens without changing active selections", async () => {
    const lens = { id: "lens", name: "Quiet", color: "#123456", expression: { kind: "all" as const, items: [] } };
    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { host, root } = mount(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={[lens]} activeLensIds={["lens"]} onSelect={onSelect} onChange={onChange}/>);
    await act(async () => (host.querySelector('button[title="Edit"]') as HTMLButtonElement).click());
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Delete lens")?.click());
    expect(onChange).toHaveBeenCalledWith([]);
    expect(onSelect).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });

  it("toggles a saved lens from its name or glass swatch and marks the whole card", async () => {
    const lens = { id: "lens", name: "A very long saved lens name", color: "#123456", expression: { kind: "all" as const, items: [] } };
    const onToggle = vi.fn();
    const { host, root } = mount(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={[lens]} activeLensIds={["lens"]} onSelect={vi.fn()} onChange={vi.fn()} onToggle={onToggle}/>);
    const card = host.querySelector('[class*="lensRow"]') as HTMLElement;
    const toggle = host.querySelector('button[aria-label="Hide: A very long saved lens name"]') as HTMLButtonElement;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(card.className).toContain("lensRowActive");
    await act(async () => (toggle.querySelector("strong") as HTMLElement).click());
    await act(async () => (toggle.querySelector('[aria-hidden="true"]') as HTMLElement).click());
    expect(onToggle).toHaveBeenNthCalledWith(1, "lens");
    expect(onToggle).toHaveBeenNthCalledWith(2, "lens");
    expect(host.querySelector('button[title="Edit"]')?.textContent).toBe("✎");
    act(() => root.unmount());
    host.remove();
  });

  it("supports independent saved toggles and clears preview separately", async () => {
    const lenses = [
      { id: "red", name: "Red", color: "#9d3f35", expression: { kind: "all" as const, items: [] } },
      { id: "green", name: "Green", color: "#35594a", expression: { kind: "all" as const, items: [] } },
    ];
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    const onPreview = vi.fn();
    const { host, root } = mount(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={lenses} activeLensIds={["red"]} previewLens={{ id: "temporary-lens", name: "Temporary filter", color: "#9d3f35", expression: { kind: "all", items: [] } }} onSelect={onSelect} onChange={vi.fn()} onToggle={onToggle} onPreview={onPreview}/>);
    expect((host.querySelector('button[aria-label="Hide: Red"]') as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
    await act(async () => (host.querySelector('button[aria-label="Show: Green"]') as HTMLButtonElement).click());
    expect(onToggle).toHaveBeenCalledWith("green");
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Turn off all")?.click());
    expect(onSelect).toHaveBeenCalledWith(undefined);
    expect(onPreview).toHaveBeenCalledWith(undefined);
    act(() => root.unmount());
    host.remove();
  });

  it("keeps the introductory and action wording localized", () => {
    const polish = renderToStaticMarkup(<StoryLenses story={emptyStoryData()} copy={storyCopy.pl} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} onPreview={vi.fn()}/>);
    const english = renderToStaticMarkup(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} onPreview={vi.fn()}/>);
    expect(polish).toContain("Pokaż na mapie obiekty spełniające wybrane warunki");
    expect(polish).toContain("Określ, jakie obiekty chcesz teraz wyróżnić na mapie.");
    expect(polish).toContain("Pokaż na mapie");
    expect(polish).toContain("Zapisz soczewkę");
    expect(polish).toContain("Wypróbuj filtr od razu na mapie");
    expect(english).toContain("Show objects on the map that match selected conditions");
    expect(english).toContain("Define which objects you want to highlight on the map.");
    expect(english).toContain("Show on map");
    expect(english).toContain("Save lens");
    expect(english).toContain("Try the filter on the map immediately without saving it.");
  });
});
