import type { InstrumentId, WorkLayerId } from "../toolbox/toolbox-model";

type GlyphId = InstrumentId | WorkLayerId | "boundary" | "cutout" | "add-outline" | "undo" | "redo" | "clear" | "fold" | "close-gaps";

const paths: Record<GlyphId, React.ReactNode> = {
  roads: <><path d="M2 14c1-4 7-4 7-8s3-4 4-4M6 14c1-3 7-3 7-8"/><path d="m7 9 2-1m1-3 1-1" strokeDasharray="1 1"/></>,
  terrain: <><path d="M2 13c3-5 5 1 8-4 1-2 2-3 4-3"/><path d="M3 9c2-2 3 1 5-2"/></>,
  boundaries: <><path d="M3 4h3m2 0h3m2 0h1v3m0 2v3m0 2H3v-3m0-2V6"/><circle cx="3" cy="4" r="1"/></>,
  buildings: <><path d="M2.5 13.5h11M4 13V6l4-3 4 3v7"/><path d="M6.5 13V9h3v4"/></>,
  construction: <><path d="M2 5h12M2 11h12"/><path d="M5 2v6m6 0v6"/></>,
  openings: <><path d="M3 13V3h7v10M10 8h3"/><path d="M7.5 8h.1"/></>,
  equipment: <><path d="M3 8h10v5H3zM4 8V5h8v3M5 13v1m6-1v1"/></>,
  sketch: <><path d="M2 12c2-7 4 4 7-5 1-3 3-4 5-2"/><path d="M3 14h10"/></>,
  select: <path d="m3 2 8 7-4 .7-1.5 3.8L3 2Z"/>,
  marquee: <><rect x="2.5" y="3" width="11" height="9" strokeDasharray="2 2"/><path d="m9.5 8 4 3.5-2 .3-.7 2L9.5 8Z"/></>,
  place: <><path d="M8 2v12M2 8h12"/><circle cx="8" cy="8" r="3"/></>,
  pencil: <><path d="m2.5 13.5 2.5-.7 7.8-7.8-1.8-1.8-7.8 7.8-.7 2.5Z"/><path d="m10 4 2 2"/></>,
  pen: <><path d="M8 2 13 7l-5 7-5-7 5-5Z"/><circle cx="8" cy="8" r="1"/><path d="M8 9v5"/></>,
  line: <><path d="M2.5 13.5 13.5 2.5"/><circle cx="2.5" cy="13.5" r="1"/><circle cx="13.5" cy="2.5" r="1"/></>,
  "wall-run": <><path d="M2 13V8h5V3h7"/><path d="M2 11h3V6h5V3"/></>,
  rectangle: <rect x="2.5" y="3" width="11" height="10"/>,
  circle: <circle cx="8" cy="8" r="5.5"/>,
  ellipse: <ellipse cx="8" cy="8" rx="6" ry="4"/>,
  arc: <><path d="M2.5 11.5a6 6 0 0 1 10-7"/><circle cx="2.5" cy="11.5" r="1"/><circle cx="12.5" cy="4.5" r="1"/><circle cx="8" cy="3" r="1"/></>,
  polygon: <path d="m8 2 5.5 4-2 7H4L2.5 6 8 2Z"/>,
  point: <><circle cx="8" cy="8" r="2"/><path d="M8 2v3m0 6v3M2 8h3m6 0h3"/></>,
  note: <><path d="M3 2.5h10v11H3z"/><path d="M5 5h6M5 8h6m-6 3h4"/></>,
  erase: <><path d="m2.5 11 6.5-7 4 4-5 5H4.5L2.5 11Z"/><path d="M8 13h6"/></>,
  boundary: <><path d="M3 3h10v10H3z"/><path d="M6 3v2m4-2v2M3 6h2m-2 4h2m8-4h-2m2 4h-2M6 13v-2m4 2v-2"/></>,
  cutout: <><path d="M2.5 3h11v10h-11z"/><path d="M5.5 6h5v4h-5z"/><path d="m10.5 2.5 3 3"/></>,
  "add-outline": <><path d="M2.5 4h8v8h-8z"/><path d="M9 8h5v5H9z"/><path d="M11.5 6v5m-2.5-2.5h5"/></>,
  undo: <><path d="M6 4H2l3-3"/><path d="M2 4c5-3 11 0 10 5-.5 3-4 5-7 3"/></>,
  redo: <><path d="M10 4h4l-3-3"/><path d="M14 4C9 1 3 4 4 9c.5 3 4 5 7 3"/></>,
  clear: <><path d="m3 5 5-3 5 3-5 3-5-3Z"/><path d="m3 8 5 3 5-3M3 11l5 3 5-3"/><path d="m11.5 1.5 3 3m0-3-3 3"/></>,
  fold: <path d="m3 6 5 5 5-5"/>,
  "close-gaps": <><path d="M2 8h3m6 0h3"/><path d="m5 5 3 3-3 3m6-6-3 3 3 3"/></>,
};

export function ToolGlyph({ id }: { id: GlyphId }) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">{paths[id]}</svg>;
}
