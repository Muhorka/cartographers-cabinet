/** Adjacent heavy label-layout scales differ by ten percent. */
export const labelLayoutZoomRatio = 1.1;

export function quantizedLabelLayoutZoom(zoom: number) {
  if (!(zoom > 0) || !Number.isFinite(zoom)) return 1;
  const exponent = Math.round(Math.log(zoom) / Math.log(labelLayoutZoomRatio));
  return Number((labelLayoutZoomRatio ** exponent).toPrecision(12));
}
