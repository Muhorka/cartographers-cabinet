import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { StoryLeftBook } from "./story-left-book";
import { StoryTopBar } from "./story-top-bar";
import { storyCopy } from "../i18n/story-copy";
import { emptyStoryData } from "../types";
import { StoryInspector } from "./story-context-panel";
import { StoryLenses } from "./story-lenses";
import { explanationFor, lensUi, predicateKinds, predicateLabel } from "./story-lens-helpers";
import { StoryZoneList } from "./story-zone-list";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("story UI contract", () => {
  it("renders an atlas slot and neutral context without fixture data", () => {
    const html = renderToStaticMarkup(<StoryLeftBook copy={storyCopy.pl} tab="atlas" activeCollection="characters" items={[]} onCollection={vi.fn()}/>);
    expect(html).toContain("Atlas");
    expect(html).toContain("Wymagana jest tylko nazwa");
  });

  it("keeps the top bar outside the atlas slot and exposes neutral choices", () => {
    const html = renderToStaticMarkup(<StoryTopBar copy={storyCopy.en} view={{ tab: "atlas", activeCollection: "characters", scenarioContext: "base" }} lenses={[]} scenarios={[]} routes={[]} onChange={vi.fn()} onScenario={vi.fn()}/>);
    expect(html.indexOf("storyStrip")).toBeLessThan(html.indexOf("Restore base view"));
    expect(html).toContain("No active lenses");
    expect(html).toContain("No active route");
  });

  it("emits scoped refs and a working bulk action for multi-selection", async () => {
    const target = { kind: "room" as const, id: "room", scopeId: "level" };
    const story = { ...emptyStoryData(), objects: [{ ref: target, metadata: {} }] };
    const onMetadataChange = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryInspector story={story} selections={[{ id: "room", kind: "room", scopeId: "level" }, { id: "room", kind: "room", scopeId: "level" }]} copy={storyCopy.en} onMetadataChange={onMetadataChange}/>));
    const labelInput = host.querySelector("input") as HTMLInputElement;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(labelInput, "North door"); labelInput.dispatchEvent(new Event("input", { bubbles: true })); });
    const add = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Add to selection"));
    await act(async () => (add as HTMLButtonElement).click());
    expect(onMetadataChange).toHaveBeenCalledWith([target, target], { narrativeLabel: "North door" }, "add");
    await act(async () => root.unmount()); host.remove();
  });

  it("sends only the edited typed property during a bulk edit", async () => {
    const target = { kind: "place" as const, id: "hall" };
    const story = { ...emptyStoryData(), propertyDefinitions: [{ id: "warmth", name: "Warmth", type: "number" as const }], objects: [{ ref: target, metadata: { properties: { warmth: 1, untouched: "keep" } } }] };
    const onMetadataChange = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryInspector story={story} selection={{ id: "hall", kind: "place" }} copy={storyCopy.en} onMetadataChange={onMetadataChange}/>));
    const propertyInput = host.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(propertyInput, "3"); propertyInput.dispatchEvent(new Event("input", { bubbles: true })); });
    const save = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save");
    await act(async () => (save as HTMLButtonElement).click());
    expect(onMetadataChange).toHaveBeenCalledWith([target], { properties: { warmth: 3 } }, "replace");
    await act(async () => root.unmount()); host.remove();
  });

  it("builds owner and group predicates in a local draft before saving", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "alice", kind: "character" as const, name: "Alice", tags: [], properties: {} }], groups: [{ id: "wardens", name: "Wardens", memberRefs: [], entryIds: [], metadata: {} }], lenses: [{ id: "lens", name: "Quiet", color: "#123456", expression: { kind: "all" as const, items: [] } }] };
    let latest = story.lenses;
    const onChange = vi.fn((items) => { latest = items as typeof latest; });
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryLenses story={story} copy={storyCopy.en} lenses={latest} activeLensId="lens" onSelect={vi.fn()} onChange={onChange}/>));
    const selects = [...host.querySelectorAll("select")];
    await act(async () => { (selects[0] as HTMLSelectElement).value = "owner"; selects[0]?.dispatchEvent(new Event("change", { bubbles: true })); });
    const valueSelect = host.querySelectorAll("select")[1] as HTMLSelectElement;
    await act(async () => { valueSelect.value = "alice"; valueSelect.dispatchEvent(new Event("change", { bubbles: true })); });
    const addButtons = [...host.querySelectorAll("button")].filter((button) => button.textContent === "Add");
    await act(async () => (addButtons.at(-1) as HTMLButtonElement).click());
    expect(onChange).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Alice");
    await act(async () => root.unmount()); host.remove();
  });

  it("persists a saved lens favorite on the canonical lens record", async () => {
    const story = { ...emptyStoryData(), lenses: [{ id: "lens", name: "Quiet", color: "#123456", favorite: false, expression: { kind: "all" as const, items: [] } }] };
    let latest = story.lenses; const onChange = vi.fn((items) => { latest = items as typeof latest; });
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryLenses story={story} copy={storyCopy.en} lenses={latest} activeLensId="lens" onSelect={vi.fn()} onChange={onChange}/>));
    const favorite = host.querySelector("button[aria-label='Favorite: Quiet']") as HTMLButtonElement;
    await act(async () => favorite.click());
    expect(onChange).toHaveBeenCalledWith([{ ...story.lenses[0], favorite: true }]);
    expect(latest[0]?.favorite).toBe(true);
    await act(async () => root.unmount()); host.remove();
  });

  it("offers friendly catalog filters and excludes keys from owner/access choices", () => {
    const story = { ...emptyStoryData(), world: [
      { id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} },
      { id: "vault-key", kind: "key" as const, name: "Vault key", tags: [], properties: {} },
    ], propertyDefinitions: [{ id: "mood", name: "Mood", type: "single" as const, options: ["calm", "tense"] }] };
    const html = renderToStaticMarkup(<StoryLenses story={story} copy={storyCopy.pl} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} />);
    expect(html).toContain("Co chcesz zobaczyć?");
    expect(html).toContain("Należy do");
    expect(html).toContain("Dostępne dla");
    expect(html).toContain("Ma cechę");
    expect(html).toContain("Strefa");
    expect(html).toContain("Anna");
    expect(html).not.toContain("Vault key");
    expect(html).not.toContain('placeholder="Tag"');
  });

  it("keeps every lens filter option labeled in both locales", () => {
    for (const copy of [storyCopy.pl, storyCopy.en]) {
      const ui = lensUi(copy);
      for (const kind of predicateKinds) expect(predicateLabel(kind, copy, ui).trim(), `${copy.locale}:${kind}`).not.toBe("");
    }
  });

  it("keeps every lens predicate type labeled in English", () => {
    const html = renderToStaticMarkup(<StoryLenses story={emptyStoryData()} copy={storyCopy.en} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} />);
    expect(html).toContain("Zone");
  });

  it("offers zones for new lenses while keeping legacy groups readable", () => {
    const story = { ...emptyStoryData(), groups: [{ id: "legacy", name: "Legacy places", memberRefs: [], entryIds: [], metadata: {} }] };
    const html = renderToStaticMarkup(<StoryLenses story={story} copy={storyCopy.en} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} />);
    expect(html).toContain(">Zone<");
    expect(html).not.toContain(">Object groups<");
    expect(explanationFor({ kind: "predicate", predicate: { kind: "group", groupId: "legacy" } }, storyCopy.en, story, [])).toBe("Zone: Legacy places");
  });

  it("explains that zones form a logical whole with shared traits", () => {
    const html = renderToStaticMarkup(<StoryZoneList zones={[]} selectionCount={0} locale="en" onSelect={vi.fn()} onCreate={vi.fn()} />);
    expect(html).toContain("one logical whole");
    expect(html).toContain("shared traits");
    expect(html).toContain("located in the Atlas");
  });

  it("labels zone-provided values as inherited in the inspector", () => {
    const ref = { kind: "place" as const, id: "hall" };
    const story = { ...emptyStoryData(), propertyDefinitions: [{ id: "mood", name: "Nastrój", type: "text" as const }, { id: "own-trait", name: "Własna cecha", type: "text" as const }], zones: [{ id: "zone-technical-id", name: "Apartament Ewy", members: [], tags: [] }], objects: [{ ref, metadata: { properties: { mood: "calm", "own-trait": "private" } } }] };
    const html = renderToStaticMarkup(<StoryInspector story={story} selection={{ id: ref.id, kind: ref.kind }} resolvedObjects={[{ ref, metadata: { properties: { mood: "calm", "own-trait": "private" } }, effectiveProperties: [{ propertyId: "mood", value: "calm", source: "zone:zone-technical-id" }, { propertyId: "own-trait", value: "private", source: "local" }] }]} copy={storyCopy.en} />);
    expect(html).toContain("Nastrój");
    expect(html).toContain("Własna cecha");
    expect(html).toContain("Inherited from zone: Apartament Ewy");
    expect(html).toContain("Own value");
  });

  it("previews a temporary lens without writing, then saves it explicitly", async () => {
    const story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }] };
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onPreview = vi.fn();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryLenses story={story} copy={storyCopy.en} lenses={[]} onSelect={onSelect} onChange={onChange} onPreview={onPreview} />));
    const selects = [...host.querySelectorAll("select")];
    await act(async () => { (selects[1] as HTMLSelectElement).value = "anna"; selects[1]?.dispatchEvent(new Event("change", { bubbles: true })); });
    const add = [...host.querySelectorAll("button")].find((button) => button.textContent === "Add") as HTMLButtonElement;
    await act(async () => add.click());
    const preview = [...host.querySelectorAll("button")].find((button) => button.textContent === "Show on map") as HTMLButtonElement;
    await act(async () => preview.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: "temporary-lens", name: "Temporary filter", expression: { kind: "all", items: [{ kind: "predicate", predicate: { kind: "owner", entryId: "anna" } }] } }));
    const save = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save lens") as HTMLButtonElement;
    await act(async () => save.click());
    const name = host.querySelector('input[placeholder="e.g. Anna\'s places"]') as HTMLInputElement;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(name, "Anna's places"); name.dispatchEvent(new Event("input", { bubbles: true })); });
    const explicitSave = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save lens") as HTMLButtonElement;
    await act(async () => explicitSave.click());
    const created = onChange.mock.lastCall?.[0] as Array<{ name: string; expression: unknown }>;
    expect(created[0]).toMatchObject({ name: "Anna's places", expression: { kind: "all", items: [{ kind: "predicate", predicate: { kind: "owner", entryId: "anna" } }] } });
    expect(onSelect).not.toHaveBeenCalledWith(expect.stringMatching(/^lens-/));
    await act(async () => root.unmount()); host.remove();
  });

  it("uses the declared property editor and keeps keys out of access choices", async () => {
    const story = { ...emptyStoryData(), world: [
      { id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} },
      { id: "vault-key", kind: "key" as const, name: "Vault key", tags: [], properties: {} },
    ], propertyDefinitions: [{ id: "height", name: "Height", type: "number" as const, unit: "m" }] };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryLenses story={story} copy={storyCopy.en} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} />));
    const typeSelect = host.querySelector("select") as HTMLSelectElement;
    await act(async () => { typeSelect.value = "access"; typeSelect.dispatchEvent(new Event("change", { bubbles: true })); });
    expect([...host.querySelectorAll("select")[2].options].map((option) => option.textContent)).toEqual(["Choose an entry", "Anna"]);
    await act(async () => { typeSelect.value = "property"; typeSelect.dispatchEvent(new Event("change", { bubbles: true })); });
    const propertySelect = host.querySelectorAll("select")[1] as HTMLSelectElement;
    await act(async () => { propertySelect.value = "height"; propertySelect.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector('input[type="number"]')).not.toBeNull();
    await act(async () => root.unmount()); host.remove();
  });

  it("localizes booleans and renders multi-value properties as named checkboxes", async () => {
    const story = { ...emptyStoryData(), propertyDefinitions: [
      { id: "visible", name: "Widoczny", type: "boolean" as const },
      { id: "mood", name: "Nastrój", type: "multi" as const, options: ["spokojny", "czujny"] },
    ] };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryLenses story={story} copy={storyCopy.pl} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} />));
    const typeSelect = host.querySelector("select") as HTMLSelectElement;
    await act(async () => { typeSelect.value = "property"; typeSelect.dispatchEvent(new Event("change", { bubbles: true })); });
    const propertySelect = host.querySelectorAll("select")[1] as HTMLSelectElement;
    await act(async () => { propertySelect.value = "visible"; propertySelect.dispatchEvent(new Event("change", { bubbles: true })); });
    expect([...host.querySelectorAll("select")[2].options].map((option) => option.textContent)).toEqual(["Neutralnie", "Tak", "Nie"]);
    await act(async () => { propertySelect.value = "mood"; propertySelect.dispatchEvent(new Event("change", { bubbles: true })); });
    expect([...host.querySelectorAll('input[type="checkbox"]')].filter((input) => ["spokojny", "czujny"].includes(input.closest("label")?.textContent ?? ""))).toHaveLength(2);
    expect(host.querySelector('select[multiple]')).toBeNull();
    await act(async () => root.unmount()); host.remove();
  });

  it("keeps legacy tags from resolved object metadata in the selectable catalog", async () => {
    const ref = { kind: "place" as const, id: "hall" };
    const story = emptyStoryData();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryLenses story={story} copy={storyCopy.en} resolvedObjects={[{ ref, metadata: { tags: ["ancient"] } }]} lenses={[]} onSelect={vi.fn()} onChange={vi.fn()} />));
    const typeSelect = host.querySelector("select") as HTMLSelectElement;
    await act(async () => { typeSelect.value = "tag"; typeSelect.dispatchEvent(new Event("change", { bubbles: true })); });
    expect([...host.querySelectorAll("select")[1].options].map((option) => option.textContent)).toEqual(["Choose an entry", "ancient"]);
    await act(async () => root.unmount()); host.remove();
  });
});
