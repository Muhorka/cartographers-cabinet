import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConstructionDocument } from "../construction/construction-document";
import { MapSheetFeatures } from "./map-sheet-features";

const document: ConstructionDocument = {
  id: "plan", revision: 0,
  walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 12, y: 0 }, thickness: .3, role: "wall" }],
  rooms: [],
  openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1.2 }],
  transitions: [{ id: "stairs", kind: "stairs", style: "l", footprint: { kind: "rectangle", x: 1, y: 2, width: 4, height: 3 } }],
};

describe("map feature editing handles", () => {
  it("renders two direct width handles for a selected opening", () => {
    const html = renderToStaticMarkup(<svg><MapSheetFeatures document={document} prefix="test" selectedIds={new Set(["door"])} copy={{}} viewportZoom={2} selectionEnabled/></svg>);
    expect(html.match(/data-opening-resize="door"/g)).toHaveLength(2);
  });

  it("renders four footprint handles for selected stairs", () => {
    const html = renderToStaticMarkup(<svg><MapSheetFeatures document={document} prefix="test" selectedIds={new Set(["stairs"])} copy={{}} viewportZoom={2} selectionEnabled/></svg>);
    expect(html.match(/data-transition-id="stairs"/g)).toHaveLength(4);
    expect(html).toContain('data-resize-corner="north-west"');
  });
});
