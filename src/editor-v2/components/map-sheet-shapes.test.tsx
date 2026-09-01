import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrawingElement } from "../model/project-model";
import { ElementShape } from "./map-sheet-shapes";

const shapeProps = { prefix: "test", viewportZoom: 1, pointRadius: 5, resizeHandleSize: 4, opacity: 1, selectable: false, showResizeHandles: false, selected: false };
const vegetation = (appearance?: DrawingElement["appearance"]): DrawingElement => ({ id: "plant", belongsToId: "map", name: "Plant", layerId: "equipment", subjectId: "equipment.vegetation", appearance, geometry: { kind: "point", at: { x: 2, y: 3 } }, visible: true, locked: false, tags: [], access: [], properties: {} });

describe("map sheet semantic appearance", () => {
  it("uses green vegetation by default and preserves authored fill", () => {
    expect(renderToStaticMarkup(<svg><ElementShape element={vegetation()} {...shapeProps}/></svg>)).toContain("fill:#63835f");
    expect(renderToStaticMarkup(<svg><ElementShape element={vegetation({ fillColor: "#123456" })} {...shapeProps}/></svg>)).toContain("fill:#123456");
  });
});
