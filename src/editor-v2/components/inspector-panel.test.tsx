import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workbenchCopy } from "../i18n/workbench-copy";
import { createStarterProject } from "../model/starter-project";
import { createPlace } from "../model/hierarchy-operations";
import { InspectorPanel } from "./inspector-panel";
import { act } from "react";
import { createRoot } from "react-dom/client";

const actions = {
  onUpdatePlace: vi.fn(), onUpdateElement: vi.fn(), onResizeOpening: vi.fn(),
  onDeletePlace: vi.fn(), onAddLevel: vi.fn(), onReparentPlace: vi.fn(),
  onSelect: vi.fn(),
};

describe("editor v2 inspector", () => {
  it.each(["terrain.river", "terrain.stream", "road.paved"])("shows editable ribbon width for %s", (subjectId) => {
    const base = createStarterProject("project", "Project", "pl"); const owner = base.places[0].id;
    const project = { ...base, elements: [{ id: "band", belongsToId: owner, name: "Band", subjectId, layerId: subjectId.startsWith("road") ? "roads" as const : "terrain" as const, widthMeters: 7.5, geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const html = renderToStaticMarkup(<InspectorPanel project={project} activePlaceId={owner} selections={[{ kind: "element", id: "band" }]} copy={workbenchCopy.pl} {...actions}/>);
    expect(html).toContain('value="7.5"'); expect(html).toContain('max="1000"');
    if (subjectId === "terrain.river") expect(html).toContain('#3f82ad');
  });

  it("exposes a live size field for every wall opening kind", () => {
    const base = createStarterProject("project", "Project", "pl");
    const level = base.places.find(({ kind }) => kind === "level")!;
    const construction = base.constructions.find(({ id }) => id === level.constructionId)!;
    const kinds = ["door", "window", "gate", "passage"] as const;
    const withOpenings = { ...base, constructions: base.constructions.map((document) => document.id === construction.id ? { ...document, openings: kinds.map((kind, index) => ({ id: kind, kind, wallId: document.walls[index % document.walls.length].id, position: .5, width: 1 })) } : document) };
    for (const kind of kinds) {
      const html = renderToStaticMarkup(<InspectorPanel project={withOpenings} activePlaceId={level.id} selections={[{ kind: "opening", id: kind }]} copy={workbenchCopy.pl} {...actions}/>);
      expect(html).toContain(workbenchCopy.pl.openingTypes[kind]);
      expect(html).toContain('type="number"'); expect(html).toContain('min="0.2"'); expect(html).toContain('value="1"');
    }
  });

  it("keeps the Story view informative but removes every editing action", () => {
    const project = createStarterProject("project", "Project", "pl");
    const html = renderToStaticMarkup(<InspectorPanel project={project} activePlaceId="project:building" copy={workbenchCopy.pl} readOnly {...actions}/>);
    expect(html).toContain(workbenchCopy.pl.openPlace); expect(html).toContain("disabled");
    expect(html).not.toContain("Dodaj kondygnację"); expect(html).not.toContain(">Usuń<"); expect(html).not.toContain("Kolor wypełnienia");
  });

  it("allows removing one independent root when another project root remains", () => {
    const project = createPlace(createStarterProject("project", "Project", "pl"), { id: "other-root", name: "Drugi plan", kind: "location" });
    const html = renderToStaticMarkup(<InspectorPanel project={project} activePlaceId="other-root" copy={workbenchCopy.pl} {...actions}/>);
    expect(html).toContain(">Usuń<");
  });

  it("offers an explicit return to the floor colour for a custom-coloured room", () => {
    const project = createStarterProject("project", "Project", "pl");
    const room = project.places.find(({ kind }) => kind === "room")!;
    const coloured = { ...project, places: project.places.map((place) => place.id === room.id ? { ...place, appearance: { fillColor: "#345678", fillOpacity: .6 } } : place) };
    const html = renderToStaticMarkup(<InspectorPanel project={coloured} activePlaceId="project:level" selections={[{ kind: "room", id: room.id }]} copy={workbenchCopy.pl} {...actions}/>);
    expect(html).toContain(workbenchCopy.pl.inheritAppearance);
    expect(html).toContain("#345678");
  });

  it("keeps the active-place geometry actions beside shared details when nothing is selected", () => {
    const project = createStarterProject("project", "Project", "pl");
    const building = project.places.find(({ kind }) => kind === "building")!;
    const html = renderToStaticMarkup(<InspectorPanel project={project} activePlaceId={building.id} copy={workbenchCopy.pl} detailsEditor={<div>Story details</div>} {...actions}/>);
    expect(html).toContain("Story details");
    expect(html).toContain(workbenchCopy.pl.hierarchy.addLevelAbove ?? "Dodaj piętro powyżej");
    expect(html).toContain(workbenchCopy.pl.hierarchy.addLevelBelow ?? "Dodaj piętro poniżej");
  });

  it("autosaves note text while typing without remounting the textarea", () => {
    const base = createStarterProject("project", "Project", "pl"); const level = base.places.find(({ kind }) => kind === "level")!;
    const project = { ...base, elements: [{ id: "note", belongsToId: level.id, name: "Notatka", layerId: "sketch" as const, subjectId: "sketch.note", geometry: { kind: "note" as const, at: { x: 1, y: 2 }, text: "Stary tekst", width: 20, height: 8 }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); actions.onUpdateElement.mockClear();
    act(() => root.render(<InspectorPanel project={project} activePlaceId={level.id} selections={[{ kind: "element", id: "note" }]} copy={workbenchCopy.pl} {...actions}/>));
    const textarea = container.querySelector("textarea")!; textarea.focus(); setNativeValue(textarea, "Pierwsza linia\nDruga linia");
    act(() => textarea.dispatchEvent(new Event("input", { bubbles: true })));
    expect(actions.onUpdateElement).toHaveBeenCalledWith("note", expect.objectContaining({ geometry: expect.objectContaining({ text: "Pierwsza linia\nDruga linia" }) }));
    expect(document.activeElement).toBe(textarea);
    act(() => root.unmount()); container.remove();
  });
});

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; setter?.call(element, value);
}
