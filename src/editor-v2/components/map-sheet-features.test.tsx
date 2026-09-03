import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConstructionDocument } from "../construction/construction-document";
import { MapSheetFeatures } from "./map-sheet-features";
import { selectionKey } from "../drawing/selection-reference";

const document: ConstructionDocument = {
  id: "plan", revision: 0,
  walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 12, y: 0 }, thickness: .3, role: "wall" }],
  rooms: [],
  openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1.2 }],
  transitions: [{ id: "stairs", kind: "stairs", style: "l", footprint: { kind: "rectangle", x: 1, y: 2, width: 4, height: 3 } }],
};

describe("map feature editing handles", () => {
  it("renders two direct width handles for a selected opening", () => {
    const html = renderToStaticMarkup(<svg><MapSheetFeatures document={document} prefix="test" selectedIds={new Set([selectionKey({ kind: "opening", id: "door", scopeId: document.id })])} copy={{}} viewportZoom={2} selectionEnabled/></svg>);
    expect(html.match(/data-opening-resize="door"/g)).toHaveLength(2);
  });

  it("renders four footprint handles for selected stairs", () => {
    const html = renderToStaticMarkup(<svg><MapSheetFeatures document={document} prefix="test" selectedIds={new Set([selectionKey({ kind: "transition", id: "stairs", scopeId: document.id })])} copy={{}} viewportZoom={2} selectionEnabled/></svg>);
    expect(html.match(/data-transition-id="stairs"/g)).toHaveLength(4);
    expect(html).toContain('data-resize-corner="north-west"');
  });

  it("scopes SVG definitions when context transitions reuse an id", () => {
    const sharedTransition = document.transitions[0]!;
    const html = renderToStaticMarkup(<svg><MapSheetFeatures
      document={document}
      prefix="test"
      selectedIds={new Set()}
      copy={{}}
      viewportZoom={2}
      transitionOverrides={[
        { transition: sharedTransition, scopeId: "ground-plan", index: 0 },
        { transition: { ...sharedTransition, footprint: { kind: "rectangle", x: 7, y: 2, width: 4, height: 3 } }, scopeId: "upper-plan", index: 0, transform: [1, 0, 0, 1, 0, 0] },
      ]}
    /></svg>);

    expect(html).toContain('id="test-ground-plan-stairs-stairs"');
    expect(html).toContain('id="test-ground-plan-stairs-stairs-clip"');
    expect(html).toContain('clip-path="url(#test-ground-plan-stairs-stairs-clip)"');
    expect(html).toContain('id="test-upper-plan-stairs-stairs"');
    expect(html).toContain('id="test-upper-plan-stairs-stairs-clip"');
    expect(html).toContain('clip-path="url(#test-upper-plan-stairs-stairs-clip)"');
    expect([...html.matchAll(/<clipPath id="([^"]+)"/g)].map((match) => match[1])).toHaveLength(2);
  });
});
