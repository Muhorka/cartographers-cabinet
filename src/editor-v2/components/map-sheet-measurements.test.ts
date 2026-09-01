import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { MapSheet } from "./map-sheet";

const copy = { ariaLabel: "Story map", empty: "Nothing here", compass: "Rotate map", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset view", back: "Back", northMark: "N", openingLabel: (kind: string) => `Opening ${kind}`, transitionLabel: () => "Stairs" };

describe("map measurements", () => {
  it("renders the optional grid together with visible measurement controls", () => {
    const base = createStarterProject("p", "Atlas", "en");
    const project = { ...base, measureSettings: { ...base.measureSettings, gridVisible: true, showAxes: true, gridOpacity: .42, gridSpacingMeters: 2, snapToGrid: true, units: "imperial" as const, showRoomAreas: true } };
    const html = renderToStaticMarkup(createElement(MapSheet, { project, activePlaceId: "p:world", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy }));
    expect(html).toContain("View &amp; measurements"); expect(html).toMatch(/class="[^"]*_grid_[^"]*"/);
    expect(html).toContain("1 cell: 2 feet");
    expect(html).toMatch(/class="[^"]*_gridAxis_/);
    expect(html).toContain('value="2"'); expect(html).toContain('value="imperial"'); expect(html).toContain("Object areas");
  });
});
