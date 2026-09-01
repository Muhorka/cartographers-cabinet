import { useRef, useState, type PointerEvent } from "react";
import type { KernelPoint } from "../geometry/geometry-types";
import { clientPointToMap } from "./map-sheet-gesture";
import type { SheetViewport } from "./map-sheet-geometry";

export type SelectionRotationControl = {
  center: KernelPoint; top: number; label: string;
  onPreview(degrees: number): void; onCommit(degrees: number): void; onCancel(): void;
};

/** One rotation affordance for the whole selection, independent of object type. */
export function SelectionRotationHandle({ control, viewport, sheetSize }: { control: SelectionRotationControl; viewport: SheetViewport; sheetSize: { width: number; height: number } }) {
  const drag = useRef<{ pointerId: number; start: number; center: KernelPoint } | undefined>(undefined);
  const [degrees, setDegrees] = useState(0);
  const radius = Math.max(18 / viewport.zoom, control.center.y - control.top + 22 / viewport.zoom);
  const radians = (degrees - 90) * Math.PI / 180;
  const point = { x: control.center.x + Math.cos(radians) * radius, y: control.center.y + Math.sin(radians) * radius };
  const at = (event: PointerEvent<SVGGElement>) => clientPointToMap({ x: event.clientX, y: event.clientY }, event.currentTarget.ownerSVGElement!.getBoundingClientRect(), sheetSize, viewport);
  const angle = (point: KernelPoint, center: KernelPoint) => Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
  const delta = (event: PointerEvent<SVGGElement>) => {
    const current = drag.current!; let value = angle(at(event), current.center) - current.start;
    while (value > 180) value -= 360; while (value < -180) value += 360;
    return event.shiftKey ? Math.round(value / 15) * 15 : value;
  };
  const cancel = () => { drag.current = undefined; setDegrees(0); control.onCancel(); };
  return <g data-selection-rotation="true" role="button" aria-label={control.label} tabIndex={0} style={{ cursor: "grab" }}
    onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); if (event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointerId: event.pointerId, start: angle(at(event), control.center), center: control.center }; }}
    onPointerMove={(event) => { if (!drag.current) return; event.preventDefault(); event.stopPropagation(); const next = delta(event); setDegrees(next); control.onPreview(next); }}
    onPointerUp={(event) => { if (!drag.current) return; event.preventDefault(); event.stopPropagation(); const next = delta(event); drag.current = undefined; setDegrees(0); control.onCommit(next); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={(event) => { event.stopPropagation(); cancel(); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); cancel(); }}
    onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); control.onCommit((event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 15 : 1)); } }}>
    <title>{control.label}</title>
    <line x1={point.x - Math.cos(radians) * 12 / viewport.zoom} y1={point.y - Math.sin(radians) * 12 / viewport.zoom} x2={point.x} y2={point.y} stroke="#98473b" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    <circle cx={point.x} cy={point.y} r={8 / viewport.zoom} fill="#ead9ae" stroke="#98473b" strokeWidth="1.3" vectorEffect="non-scaling-stroke"/>
    <path d={`M ${point.x - 3 / viewport.zoom} ${point.y + 2 / viewport.zoom} a ${3.5 / viewport.zoom} ${3.5 / viewport.zoom} 0 1 1 ${6 / viewport.zoom} 0 l ${-2 / viewport.zoom} ${-1 / viewport.zoom} m ${2 / viewport.zoom} ${1 / viewport.zoom} l ${1 / viewport.zoom} ${-2 / viewport.zoom}`} fill="none" stroke="#793e31" strokeWidth="1.2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
  </g>;
}
