// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";

const polish = "Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż · … ²";
const add = vi.fn();
class TestFontFace {
  constructor(public family: string, public source: ArrayBuffer, public descriptors: unknown) {}
  async load() { return this; }
}
function localFetch() {
  return vi.fn(async (url: string) => {
    const bytes = readFileSync(`public${url}`);
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  });
}
function svg() {
  return new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><text font-family="Georgia,serif">${polish}</text></svg>`, "image/svg+xml").documentElement as unknown as SVGElement;
}

describe("bundled PDF fonts", () => {
  beforeEach(() => {
    vi.resetModules(); add.mockClear();
    vi.stubGlobal("FontFace", TestFontFace);
    Object.defineProperty(document, "fonts", { configurable: true, value: { add } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads real TTFs locally, registers all styles and contains every Polish glyph", async () => {
    const fetcher = localFetch(); vi.stubGlobal("fetch", fetcher);
    const { preparePdfFonts } = await import("./pdf-fonts");
    const pdf = new jsPDF(); const element = svg();
    await preparePdfFonts(pdf, element);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(add).toHaveBeenCalledTimes(4);
    expect(element.querySelector("text")?.getAttribute("font-family")).toBe("CartographerPDFGelasio");
    for (const style of ["normal", "italic", "bold", "bolditalic"]) {
      pdf.setFont("CartographerPDFGelasio", style);
      const font = pdf.getFont() as unknown as { metadata: { characterToGlyph(code: number): number } };
      for (const char of polish) expect(font.metadata.characterToGlyph(char.codePointAt(0)!), `${style}: ${char}`).toBeGreaterThan(0);
      pdf.text(polish, 10, 20);
    }
    expect(pdf.output()).toContain("/FontFile2");
    await preparePdfFonts(new jsPDF(), svg());
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("retries a failed request instead of caching the rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { preparePdfFonts } = await import("./pdf-fonts");
    await expect(preparePdfFonts(new jsPDF(), svg())).rejects.toMatchObject({ code: "pdf-font-unavailable" });
    vi.stubGlobal("fetch", localFetch());
    await expect(preparePdfFonts(new jsPDF(), svg())).resolves.toBeUndefined();
  });
});
