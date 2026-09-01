import type { jsPDF } from "jspdf";

const family = "CartographerPDFGelasio";
const variants = [
  { file: "Gelasio-Regular.ttf", pdfStyle: "normal", style: "normal", weight: "400" },
  { file: "Gelasio-Italic.ttf", pdfStyle: "italic", style: "italic", weight: "400" },
  { file: "Gelasio-Bold.ttf", pdfStyle: "bold", style: "normal", weight: "700" },
  { file: "Gelasio-BoldItalic.ttf", pdfStyle: "bolditalic", style: "italic", weight: "700" },
] as const;

export class PdfFontError extends Error {
  readonly code = "pdf-font-unavailable";
  constructor(cause?: unknown) { super("The bundled PDF font could not be loaded.", { cause }); this.name = "PdfFontError"; }
}

type LoadedFont = { file: string; pdfStyle: string; base64: string };
let loadedFonts: Promise<LoadedFont[]> | undefined;

function encodeFont(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function loadFonts() {
  if (!loadedFonts) loadedFonts = Promise.all(variants.map(async (variant) => {
    const response = await fetch(`/fonts/gelasio/${variant.file}`);
    if (!response.ok) throw new PdfFontError();
    const bytes = await response.arrayBuffer();
    // svg2pdf measures text in the browser too: use the same font there and in PDF.
    // This private family is never assigned to editor UI or SVG/PNG exports.
    const face = new FontFace(family, bytes, { style: variant.style, weight: variant.weight });
    await face.load();
    document.fonts.add(face);
    return { file: variant.file, pdfStyle: variant.pdfStyle, base64: encodeFont(bytes) };
  })).catch((cause: unknown) => { loadedFonts = undefined; throw new PdfFontError(cause); });
  return loadedFonts;
}

export async function preparePdfFonts(pdf: jsPDF, svg: SVGElement) {
  const fonts = await loadFonts();
  for (const font of fonts) {
    pdf.addFileToVFS(font.file, font.base64);
    pdf.addFont(font.file, family, font.pdfStyle);
  }
  pdf.setFont(family, "normal");
  svg.setAttribute("font-family", family);
  for (const node of svg.querySelectorAll("[font-family]")) node.setAttribute("font-family", family);
}
