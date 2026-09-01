import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workbenchCopy } from "../i18n/workbench-copy";
import { projectLibraryCopy } from "../i18n/project-library-copy";
import { createProjectAtScale } from "../model/starter-project";
import { ProjectLibraryDialog } from "./project-library-dialog";

describe("editor v2 project library", () => {
  it("offers every useful starting scale without inventing a demo hierarchy", () => {
    const project = createProjectAtScale("project", "My map", "en", "room");
    const html = renderToStaticMarkup(<ProjectLibraryDialog projects={[project]} activeProjectId={project.id} copy={workbenchCopy.en} draftName="" startingScale="building" onDraftName={vi.fn()} onStartingScale={vi.fn()} onCreate={vi.fn()} onOpen={vi.fn()} onDuplicate={vi.fn()} onAskDelete={vi.fn()} onDelete={vi.fn()} onCancelDelete={vi.fn()} onClose={vi.fn()}/>);
    for (const label of ["World", "Place", "Building", "Level", "Room"]) expect(html).toContain(label);
    expect(html).toContain('<option value="building" selected="">Building</option>');
  });

  it("uses neutral Polish count labels in project cards", () => {
    const project = createProjectAtScale("project", "Mapa", "pl", "location");
    const html = renderToStaticMarkup(<ProjectLibraryDialog projects={[project]} activeProjectId={project.id} copy={workbenchCopy.pl} libraryCopy={projectLibraryCopy.pl} draftName="" startingScale="location" onDraftName={vi.fn()} onStartingScale={vi.fn()} onCreate={vi.fn()} onOpen={vi.fn()} onDuplicate={vi.fn()} onAskDelete={vi.fn()} onDelete={vi.fn()} onCancelDelete={vi.fn()} onClose={vi.fn()}/>);
    expect(html).toContain("Poziomy mapy: 1");
    expect(html).toContain("Rysunki: 0");
  });
});
