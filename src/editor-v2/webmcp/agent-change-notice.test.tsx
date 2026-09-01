import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentChangeNotice, type AgentChangeReport } from "./agent-change-notice";
import { projectDiff } from "./project-diff";
import { reviewFixture } from "../story/review/review-test-fixture";
import { readProposalChanges } from "../story/review/proposal-change-review";
import type { ProposalChangeInput, ProposalChangeReadResult } from "../story/review/proposal-change-types";
import { projectRevision } from "../state/project-revision";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanup: Array<() => void> = [];
afterEach(() => cleanup.splice(0).forEach((unmount) => act(unmount)));

function fixture() {
  const before = reviewFixture(); const ref = { kind: "opening" as const, id: "door", scopeId: "construction" };
  before.story.objects.push({ ref, metadata: { owners: ["alice"], tags: ["old"] } });
  const after = structuredClone(before); after.story.objects[0].metadata = { owners: ["staff"], tags: ["new"] };
  const checkpoint = { id: "proposal", projectId: before.id, kind: "proposal" as const, baseSnapshot: before, snapshot: after };
  const read = (input: ProposalChangeInput) => readProposalChanges(checkpoint, before, input);
  const initial = read({ checkpointId: checkpoint.id, limit: 1 });
  const report: AgentChangeReport = { summary: "Synthetic proposed change", changes: projectDiff(before, after), checkpointId: checkpoint.id, proposal: true, semanticChanges: initial };
  return { before, after, checkpoint, read, initial, report };
}
function mount(report: AgentChangeReport, onRead?: (input: ProposalChangeInput) => Promise<ProposalChangeReadResult>, locale: "pl" | "en" = "en") {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  cleanup.push(() => { root.unmount(); host.remove(); });
  const render = (currentRevision?: string, currentProjectId?: string) => act(() => root.render(<AgentChangeNotice report={report} locale={locale} onUndo={vi.fn()} onCompare={vi.fn()} onClose={vi.fn()} onReadProposalChanges={onRead} currentRevision={currentRevision} currentProjectId={currentProjectId}/>));
  render(); return { host, render, button: (text: string) => [...host.querySelectorAll("button")].find((node) => node.textContent === text)! };
}

describe("semantic proposal details inside the existing agent notice", () => {
  it.each(["pl", "en"] as const)("explains incomplete coverage with raw codes only in collapsed details (%s)", (locale) => {
    const f = fixture(); if (f.initial.status !== "ready") throw new Error("Expected proposal page");
    const codes = ["story.groups", "ambiguous-story-records", "future-coverage-reason"];
    f.initial.coverage.unsupportedChanges = codes;
    const before = structuredClone(f.report);
    const { host } = mount(f.report, undefined, locale);
    const section = host.querySelector('section[aria-label="' + (locale === "pl" ? "Proponowane zmiany pól" : "Proposed field changes") + '"]')!;
    const technical = [...section.querySelectorAll("details")].find((node) => node.querySelector("summary")?.textContent === (locale === "pl" ? "Kody techniczne ograniczeń" : "Technical coverage codes"))!;
    expect(technical.open).toBe(false);
    expect([...technical.querySelectorAll("code")].map(({ textContent }) => textContent)).toEqual(codes);
    const visible = section.cloneNode(true) as HTMLElement;
    visible.querySelectorAll("details").forEach((node) => node.remove());
    for (const code of codes) expect(visible.textContent).not.toContain(code);
    expect(visible.textContent).toContain(locale === "pl" ? "Grupy obiektów" : "Object groups");
    expect(visible.textContent).toContain(locale === "pl" ? "Nie rozpoznano przyczyny" : "not recognized");
    expect([...visible.querySelectorAll("strong")].some((node) => node.textContent?.includes(locale === "pl" ? "Raport nie obejmuje wszystkich zmian" : "does not cover all changes"))).toBe(true);
    expect(f.report).toEqual(before);
  });

  it("preserves reference and context filters on next and first page", async () => {
    const f = fixture(); const query = { refs: [f.before.story.objects[0].ref], context: {} };
    f.report.semanticChanges = f.read({ checkpointId: "proposal", limit: 1, ...query });
    const loader = vi.fn(async (input: ProposalChangeInput) => f.read(input));
    const { host, button } = mount(f.report, loader);
    await act(async () => button("Next page").click());
    expect(host.querySelector("[data-change-field]")?.getAttribute("data-change-field")).toBe("tags");
    expect(loader).toHaveBeenLastCalledWith(expect.objectContaining(query));
    await act(async () => button("First page").click());
    expect(host.querySelector("[data-change-field]")?.getAttribute("data-change-field")).toBe("owners");
    expect(loader).toHaveBeenLastCalledWith(expect.objectContaining({ ...query, cursor: undefined }));
  });

  it("shows named authored/effective before and proposed-after fields, coverage and the next page", async () => {
    const f = fixture(); const loader = vi.fn(async (input: ProposalChangeInput) => f.read(input));
    const { host, button } = mount(f.report, loader);
    expect(host.textContent).toContain("Direct object and scenario/step field changes only");
    expect(host.textContent).toContain("Authored field"); expect(host.textContent).toContain("Effective in this context");
    expect(host.textContent).toContain("Before: Alice → Proposed after: Staff");
    expect(host.querySelectorAll("[data-change-field]")).toHaveLength(1);
    expect([...host.querySelectorAll("button")].some((node) => node.textContent === "Undo")).toBe(false);
    expect(button("Show tracing")).toBeDefined();
    await act(async () => button("Next page").click());
    expect(host.querySelector("[data-change-field]")?.getAttribute("data-change-field")).toBe("tags");
    expect(host.textContent).toContain("Before: old → Proposed after: new");
    expect(loader).toHaveBeenCalledOnce();
  });

  it("marks historical values stale and ignores a late page after the live revision changes", async () => {
    const f = fixture(); let resolve!: (result: ProposalChangeReadResult) => void;
    const { host, render, button } = mount(f.report, () => new Promise((done) => { resolve = done; }));
    render(projectRevision(f.before), f.before.id);
    act(() => button("Next page").click()); render("newer-live-revision", f.before.id);
    const next = f.initial.status === "ready" ? f.read({ checkpointId: "proposal", limit: 1, cursor: f.initial.nextCursor }) : f.initial;
    await act(async () => resolve(next));
    expect(host.textContent).toContain("historical saved proposal comparison");
    expect(host.querySelector("[data-change-field]")?.getAttribute("data-change-field")).toBe("owners");
    render("other-project-revision", "other"); expect(host.querySelector("[data-change-field]")).toBeNull();
  });
});
