import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { projectLibraryCopy } from "../i18n/project-library-copy";
import type { ProjectLibraryRecoveryRecord } from "../persistence/project-library";
import { ProjectLibraryRecovery } from "./project-library-recovery";

const record: ProjectLibraryRecoveryRecord = { primaryKey: "dexie-key", rawRecord: { id: "broken" }, reason: "name: Invalid input" };

describe("project library recovery UI", () => {
  it("shows the blocking Polish recovery screen with export as the only action", () => {
    const html = renderToStaticMarkup(<ProjectLibraryRecovery records={[record]} copy={projectLibraryCopy.pl} blocking onExport={vi.fn()} />);
    expect(html).toContain("Nie udało się wczytać żadnego poprawnego projektu");
    expect(html).toContain("Eksportuj kopię awaryjną");
    expect(html).toContain("Klucz Dexie: dexie-key");
    expect(html).not.toContain("Utwórz");
    expect(html).not.toContain("Usuń");
  });

  it("renders the non-blocking English warning for healthy plus damaged records", () => {
    const html = renderToStaticMarkup(<ProjectLibraryRecovery records={[record]} copy={projectLibraryCopy.en} onExport={vi.fn()} />);
    expect(html).toContain("Some saved projects need recovery (1)");
    expect(html).toContain("Export emergency copy");
  });
});
