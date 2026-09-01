// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";

const pdfMocks = vi.hoisted(() => ({ svg: vi.fn().mockResolvedValue(undefined), save: vi.fn() }));
const fontMocks = vi.hoisted(() => ({ prepare: vi.fn().mockResolvedValue(undefined) }));
vi.mock("jspdf", () => ({ jsPDF: class { svg = pdfMocks.svg; save = pdfMocks.save; } }));
vi.mock("svg2pdf.js", () => ({}));
vi.mock("./pdf-fonts", () => ({ preparePdfFonts: fontMocks.prepare }));
import { exportProjectViewPdf, exportProjectViewPng, exportProjectViewSvg } from "./project-export-browser";

describe("browser project view exports", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pdfMocks.svg.mockClear();
    pdfMocks.save.mockClear();
    fontMocks.prepare.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("downloads SVG as a safe authored-text blob", () => {
    const project = createStarterProject("export", "Map <&>", "en");
    const svg = exportProjectViewSvg({ project, activePlaceId: project.places[0]!.id });
    expect(svg).toContain("Map &lt;&amp;&gt;");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "image/svg+xml;charset=utf-8" }));
  });

  it("renders PNG through stubbed Image and canvas APIs", async () => {
    class FakeImage { decoding = ""; src = ""; decode = vi.fn().mockResolvedValue(undefined); }
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));
    const project = createStarterProject("png", "PNG", "en");
    const blob = await exportProjectViewPng({ project, activePlaceId: project.places[0]!.id, width: 320, height: 200 });
    expect(blob.type).toBe("image/png");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("embeds fonts before exporting Polish text without replacing characters", async () => {
    const project = createStarterProject("pdf", "PDF", "en");
    await exportProjectViewPdf({ project, activePlaceId: project.places[0]!.id, width: 320, height: 200, title: "Droga łukowa · Łąka · Ścieżka" });
    expect(fontMocks.prepare).toHaveBeenCalledOnce();
    expect(fontMocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(pdfMocks.svg.mock.invocationCallOrder[0]!);
    expect((pdfMocks.svg.mock.calls[0]?.[0] as SVGElement).textContent).toContain("Droga łukowa · Łąka · Ścieżka");
    expect(pdfMocks.save).toHaveBeenCalledOnce();
  });

  it("does not save a broken PDF when font loading fails", async () => {
    fontMocks.prepare.mockRejectedValueOnce(new Error("Font failed"));
    const project = createStarterProject("pdf", "Łąka", "pl");
    await expect(exportProjectViewPdf({ project })).rejects.toThrow("Font failed");
    expect(pdfMocks.svg).not.toHaveBeenCalled();
    expect(pdfMocks.save).not.toHaveBeenCalled();
  });

  it("passes parsed ASCII SVG to vector PDF exporter", async () => {
    const project = createStarterProject("pdf", "PDF", "en");
    await exportProjectViewPdf({ project, activePlaceId: project.places[0]!.id, width: 320, height: 200, title: "Road path - Meadow" });
    expect(pdfMocks.svg).toHaveBeenCalledOnce();
    expect((pdfMocks.svg.mock.calls[0]?.[0] as SVGElement).outerHTML).toContain("Road path - Meadow");
    expect(pdfMocks.save).toHaveBeenCalledWith("pdf-view.pdf");
  });
});
