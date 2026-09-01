import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roadAppearance } from "../roads/road-style";
import type { DrawingElement } from "../model/project-model";
import { RoadShape } from "./road-shape";

const road: DrawingElement = { id: "road", belongsToId: "map", name: "Droga", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false }, widthMeters: 4, visible: true, locked: false, tags: [], access: [], properties: {} };
describe("road appearance", () => {
  it("uses the same default colour and opacity as the property inspector", () => {
    const appearance = roadAppearance(road);
    const html = renderToStaticMarkup(<RoadShape element={road} prefix="test" zoom={2} handles={false} selected={false}/>);
    expect(html).toContain(`fill="${appearance.fillColor}"`);
    expect(html).toContain(`opacity="${appearance.fillOpacity}"`);
  });
  it("applies zero opacity to all painted layers without removing the selection hit area", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<svg><RoadShape element={{ ...road, appearance: { fillOpacity: 0 } }} prefix="test" zoom={2} handles={false} selected={false}/></svg>);
    expect(host.querySelector('g[opacity="0"]')?.querySelectorAll("path")).toHaveLength(2);
    expect(host.querySelector('path[pointer-events="all"]')?.getAttribute("fill")).toBe("transparent");
  });
});
