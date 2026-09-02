import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { checkpointCopy } from "../i18n/checkpoint-copy";
import { createStarterProject } from "../model/starter-project";
import { createProjectCheckpoint } from "../persistence/project-checkpoint";
import { CheckpointPanel } from "./checkpoint-panel";

describe("checkpoint panel", () => {
  it("presents a preserved state as a restorable tracing", () => {
    const checkpoint = createProjectCheckpoint(createStarterProject("project", "Project", "pl"), { id: "before", name: "Przed zmianą", createdAt: "2026-08-29T20:00:00.000Z" });
    const html = renderToStaticMarkup(<CheckpointPanel checkpoints={[checkpoint]} activeCheckpointId="before" tracingOpacity={.4} copy={checkpointCopy.pl} locale="pl" onSave={vi.fn()} onTracing={vi.fn()} onOpacity={vi.fn()} onRestore={vi.fn()} onRemove={vi.fn()}/>);
    expect(html).toContain("Przed zmianą");
    expect(html).toContain("Zdejmij kalkę");
    expect(html).toContain("Przywróć");
  });

  it("handles a rejected UI deletion while leaving the rejection for WebMCP callers", async () => {
    const checkpoint = createProjectCheckpoint(createStarterProject("project", "Project", "pl"), { id: "before", name: "Przed zmianą" });
    const onRemove = vi.fn(() => Promise.reject(new Error("Delete failed")));
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<CheckpointPanel checkpoints={[checkpoint]} tracingOpacity={.4} copy={checkpointCopy.pl} locale="pl" onSave={vi.fn()} onTracing={vi.fn()} onOpacity={vi.fn()} onRestore={vi.fn()} onRemove={onRemove} />));
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === checkpointCopy.pl.remove)?.click());
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === checkpointCopy.pl.confirm)?.click());
    expect(onRemove).toHaveBeenCalledWith("before");
    root.unmount(); host.remove();
  });
});
