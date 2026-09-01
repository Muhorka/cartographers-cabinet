/** Pointer angle in sheet space; independent of the map's zoom and rotation. */
export function compassRotationAt(event: { clientX: number; clientY: number; currentTarget: SVGSVGElement }, sheetSize: { width: number; height: number }) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const point = { x: (event.clientX - bounds.left) / bounds.width * sheetSize.width, y: (event.clientY - bounds.top) / bounds.height * sheetSize.height };
  const degrees = Math.atan2(point.y - (sheetSize.height - 58), point.x - 58) * 180 / Math.PI + 90;
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}
