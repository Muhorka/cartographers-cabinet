import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { projectLibraryCopy } from "../i18n/project-library-copy";
import type { ProjectLibraryRecoveryRecord } from "../persistence/project-library";
import { ProjectLibraryRecovery } from "./project-library-recovery";

const record: ProjectLibraryRecoveryRecord = { primaryKey: "dexie-key", rawRecord: { id: "broken" }, reason: "name: Invalid input" };

describe("project library recovery UI", () => {
  it("allows entering a new project while preserving the recovery record", () => {
    const onCreate = vi.fn();
    const html = renderToStaticMarkup(<ProjectLibraryRecovery records={[record]} copy={projectLibraryCopy.pl} blocking onExport={vi.fn()} onCreate={onCreate} />);
    expect(html).toContain("Nie udało się wczytać żadnego poprawnego projektu");
    expect(html).toContain("Eksportuj kopię awaryjną");
    expect(html).toContain("Utwórz nowy projekt");
    expect(html).toContain("Klucz Dexie: dexie-key");
    expect(html).not.toContain("Usuń");

    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    act(() => root.render(<ProjectLibraryRecovery records={[record]} copy={projectLibraryCopy.pl} blocking onExport={vi.fn()} onCreate={onCreate} />));
    act(() => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Utwórz nowy projekt")?.click());
    expect(onCreate).toHaveBeenCalledOnce(); root.unmount(); host.remove();
  });

  it("renders the non-blocking English warning for healthy plus damaged records", () => {
    const html = renderToStaticMarkup(<ProjectLibraryRecovery records={[record]} copy={projectLibraryCopy.en} onExport={vi.fn()} />);
    expect(html).toContain("Some saved projects need recovery (1)");
    expect(html).toContain("Export emergency copy");
  });
});
