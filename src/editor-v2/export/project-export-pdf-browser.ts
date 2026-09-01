import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { renderProjectViewSvg, type ProjectRenderOptions } from "./project-renderer";
import { preparePdfFonts } from "./pdf-fonts";
import { projectViewExportName } from "./project-export-browser";

export async function exportProjectViewPdf(options: ProjectRenderOptions) {
  const svg = renderProjectViewSvg(options);
  const width = options.width ?? 1200;
  const height = options.height ?? 820;
  const element = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement as unknown as SVGElement;
  const pdf = new jsPDF({ orientation: width >= height ? "landscape" : "portrait", unit: "px", format: [width, height], putOnlyUsedFonts: true });
  await preparePdfFonts(pdf, element);
  await pdf.svg(element, { x: 0, y: 0, width, height });
  pdf.save(projectViewExportName(options.project, "pdf"));
  return pdf;
}
