import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapGesturePreview } from "./map-gesture-preview";

describe("map gesture preview", () => {
  it("shows exactly the same eraser radius that the map sends to the geometry engine", () => {
    const html = renderToStaticMarkup(<svg><MapGesturePreview draft={{ instrumentId: "erase", points: [{ x: 2, y: 3 }, { x: 8, y: 3 }] }} viewportZoom={2} eraserSize={12}/></svg>);
    expect(html).toContain("stroke-width:24"); expect(html).toContain('cx="8" cy="3" r="6"');
  });

  it("keeps drawing nodes at a stable screen size while zooming", () => {
    const html = renderToStaticMarkup(<svg><MapGesturePreview draft={{ instrumentId: "line", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }} viewportZoom={4} eraserSize={10}/></svg>);
    expect(html).toContain('r="0.6"');
  });
  it("renders the same pencil smoothing that commit will apply, without moving endpoints", () => {
    const draft = { instrumentId: "pencil" as const, points: [{ x: 0, y: 0 }, { x: 1, y: 4 }, { x: 2, y: 0 }] };
    const raw = renderToStaticMarkup(<svg><MapGesturePreview draft={draft} viewportZoom={1} eraserSize={10} pencilSmoothing={0}/></svg>);
    const smoothed = renderToStaticMarkup(<svg><MapGesturePreview draft={draft} viewportZoom={1} eraserSize={10} pencilSmoothing={1}/></svg>);
    expect(raw).toContain('d="M 0 0 L 1 4 L 2 0"');
    expect(smoothed).toContain('d="M 0 0 L 1 ');
    expect(smoothed).toContain('L 2 0"');
    expect(smoothed).not.toContain('L 1 4 L');
  });
  it("shows a pointer-transparent live length and angle for the last segment", () => {
    const html = renderToStaticMarkup(<svg><MapGesturePreview draft={{ instrumentId: "line", points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] }} viewportZoom={2} eraserSize={10}/></svg>);
    expect(html).toContain('data-gesture-measurement="true"'); expect(html).toContain("5 m"); expect(html).toContain("53.1°"); expect(html).toContain("pointer-events:none");
  });
  it("shows rectangle dimensions in the selected units and offsets them from the cursor", () => {
    const html = renderToStaticMarkup(<svg><MapGesturePreview draft={{ instrumentId: "rectangle", points: [{ x: 10, y: 12 }], hover: { x: 14, y: 14 } }} viewportZoom={1} eraserSize={10} unit="imperial" measurementCopy={{ width: "Szer.", height: "Wys.", length: "Długość", angle: "Kąt" }}/></svg>);
    expect(html).toContain("Szer. 13.12 ft"); expect(html).toContain("Wys. 6.56 ft"); expect(html).toContain("translate(26 2)");
  });
  it.each([.1, 1, 20])("keeps both the label and background readable at zoom %s", (zoom) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<svg><MapGesturePreview draft={{ instrumentId: "line", points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] }} viewportZoom={zoom} eraserSize={10}/></svg>);
    const readout = host.querySelector("[data-gesture-measurement]")!;
    expect(Number(readout.querySelector("text")!.getAttribute("font-size")) * zoom).toBe(10);
    expect(Number(readout.querySelector("rect")!.getAttribute("height")) * zoom).toBe(30);
  });
});
