import { useState, type PointerEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { KernelPoint } from "../geometry/geometry-types";
import type { MapSheetProps } from "./map-sheet-types";
import { clientPointToMap } from "./map-sheet-gesture";
import type { SheetViewport } from "./map-sheet-geometry";

/** Intercept insertion before selection/dragging, in unsnapped map coordinates. */
export function useMapNodeInsertion(controller: MapSheetProps["nodeInsertion"], viewport: SheetViewport, sheetSize: { width: number; height: number }) {
  const [hover, setHover] = useState<KernelPoint>();
  const nearest = (point: KernelPoint) => {
    const target = controller?.previewAt(point);
    return target && Math.hypot(target.x - point.x, target.y - point.y) * viewport.zoom <= 12 ? target : undefined;
  };
  const at = (event: PointerEvent<SVGSVGElement>) => clientPointToMap({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), sheetSize, viewport);
  const intercept = (event: { preventDefault(): void; stopPropagation(): void }) => { event.preventDefault(); event.stopPropagation(); };
  const cancel = (event: { preventDefault(): void; stopPropagation(): void }) => { if (!controller?.active) return; intercept(event); setHover(undefined); controller.cancel(); };
  const preview = controller?.active && hover ? nearest(hover) : undefined;
  return {
    handlers: {
      onPointerDownCapture: (event: PointerEvent<SVGSVGElement>) => {
        if (!controller?.active) return;
        intercept(event); event.currentTarget.focus({ preventScroll: true });
        if (event.button !== 0) return;
        const point = at(event); setHover(point); if (nearest(point)) controller.insertAt(point);
      },
      onPointerMoveCapture: (event: PointerEvent<SVGSVGElement>) => { if (controller?.active) { intercept(event); setHover(at(event)); } },
      onPointerUpCapture: (event: PointerEvent<SVGSVGElement>) => { if (controller?.active) intercept(event); },
      onPointerLeave: () => setHover(undefined),
      onClickCapture: (event: MouseEvent<SVGSVGElement>) => { if (controller?.active) intercept(event); },
      onContextMenuCapture: (event: MouseEvent<SVGSVGElement>) => cancel(event),
      onKeyDownCapture: (event: KeyboardEvent<SVGSVGElement>) => { if (event.key === "Escape") cancel(event); },
    },
    marker: preview ? <circle data-node-insertion-preview="true" cx={preview.x} cy={preview.y} r={4 / viewport.zoom} fill="#eeddb1" stroke="#98473b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ pointerEvents: "none" }}/> : null,
  };
}
