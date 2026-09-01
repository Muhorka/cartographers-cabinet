import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultPlanningSelectionCopy, PlanningSelectionActions, type PlanningSelectionCopy } from "./planning-selection-actions";
import { defaultPlanningMeasurementCopy, PlanningMeasurementReadout, type PlanningMeasurementCopy } from "./planning-measurement-readout";
import { defaultPlanningGeometryInspectorCopy, PlanningGeometryInspector } from "./planning-geometry-inspector";

describe("planning controls", () => {
  it("renders alignment actions only for a multi-selection", () => {
    const html = renderToStaticMarkup(createElement(PlanningSelectionActions, { count: 3, onAlign: vi.fn(), onDistribute: vi.fn() }));
    expect(html).toContain("Align start"); expect(html).toContain("Distribute evenly"); expect(renderToStaticMarkup(createElement(PlanningSelectionActions, { count: 1, onAlign: vi.fn(), onDistribute: vi.fn() }))).toBe("");
  });
  it("renders a live, localized measurement readout", () => {
    const html = renderToStaticMarkup(createElement(PlanningMeasurementReadout, { dimensions: { width: 4, height: 2, area: 8, angle: 45 }, unit: "imperial", live: true }));
    expect(html).toContain("Live"); expect(html).toContain("13.12 ft"); expect(html).toContain("86.11 ft²"); expect(html).not.toContain("8 ft"); expect(html).toContain("45°");
    const metric = renderToStaticMarkup(createElement(PlanningMeasurementReadout, { dimensions: { width: 4, height: 2, area: 8 }, unit: "metric" }));
    expect(metric).toContain("8 m²"); expect(metric).not.toContain("8 m<");
    const copies: [PlanningMeasurementCopy, PlanningSelectionCopy] = [defaultPlanningMeasurementCopy, defaultPlanningSelectionCopy]; expect(copies).toHaveLength(2);
  });
  it("shows node controls and only exposes split when explicitly supplied", () => {
    const html = renderToStaticMarkup(createElement(PlanningGeometryInspector, { kind: "bezier", nodeCount: 3, selectedNode: 1, smooth: true, onSelectNode: vi.fn(), onInsert: vi.fn(), onRemove: vi.fn(), onToggleSmooth: vi.fn() }));
    expect(html).toContain("Geometry nodes"); expect(html).toContain("Sharp"); expect(html).not.toContain("Split at this node");
    expect(renderToStaticMarkup(createElement(PlanningGeometryInspector, { kind: "region", nodeCount: 4, selectedNode: 0, onSelectNode: vi.fn(), onInsert: vi.fn(), onRemove: vi.fn(), onSplit: vi.fn() }))).toContain("Split at this node");
    expect(defaultPlanningGeometryInspectorCopy.title).toBe("Geometry nodes");
  });
  it("shows a persistent controlled-insertion hint and toggle state", () => {
    const html = renderToStaticMarkup(createElement(PlanningGeometryInspector, { kind: "path", nodeCount: 3, selectedNode: 2, insertionActive: true, onSelectNode: vi.fn(), onInsert: vi.fn(), onCancelInsert: vi.fn(), onRemove: vi.fn() }));
    expect(html).toContain("Cancel insertion"); expect(html).toContain("Click the line to place a node"); expect(html).toContain('aria-pressed="true"');
  });
});
