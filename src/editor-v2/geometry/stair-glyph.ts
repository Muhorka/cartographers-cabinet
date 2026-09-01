export type StairStyle = "straight" | "l" | "u" | "spiral" | "curved";
export type StairBounds = { minX: number; maxX: number; minY: number; maxY: number };
export type StairGlyphPrimitive =
  | { kind: "line"; className: "tread"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "circle"; className: "stairCore" | "stairPost"; cx: number; cy: number; r: number }
  | { kind: "path"; className: "tread" | "direction" | "flightEdge"; d: string };

export function stairGlyphPrimitives(stairStyle: StairStyle, bounds: StairBounds): StairGlyphPrimitive[] {
  const w = bounds.maxX - bounds.minX; const h = bounds.maxY - bounds.minY; const x = bounds.minX; const y = bounds.minY; const cx = x + w / 2; const cy = y + h / 2;
  const horizontalTreads = (fromY: number, toY: number, left = x + w * .12, right = x + w * .88): StairGlyphPrimitive[] => Array.from({ length: 8 }, (_, index) => { const yy = fromY + (toY - fromY) * index / 7; return { kind: "line", className: "tread", x1: left, y1: yy, x2: right, y2: yy }; });
  const verticalTreads = (fromX: number, toX: number, top = y + h * .12, bottom = y + h * .88): StairGlyphPrimitive[] => Array.from({ length: 6 }, (_, index) => { const xx = fromX + (toX - fromX) * index / 5; return { kind: "line", className: "tread", x1: xx, y1: top, x2: xx, y2: bottom }; });
  if (stairStyle === "spiral") { const radius = Math.min(w, h) * .42; return [...Array.from({ length: 14 }, (_, index) => { const angle = index / 14 * Math.PI * 2; return { kind: "line" as const, className: "tread" as const, x1: cx, y1: cy, x2: cx + Math.cos(angle) * radius, y2: cy + Math.sin(angle) * radius }; }), { kind: "circle", className: "stairCore", cx, cy, r: radius }, { kind: "circle", className: "stairPost", cx, cy, r: Math.max(.12, radius * .08) }, { kind: "path", className: "direction", d: `M ${cx + radius * .2} ${cy + radius * .1} A ${radius * .6} ${radius * .6} 0 1 1 ${cx - radius * .1} ${cy - radius * .55} l 2 1.5 -2.4 .7` }]; }
  if (stairStyle === "l") return [...horizontalTreads(cy, y + h * .9, x + w * .12, cx), ...verticalTreads(cx, x + w * .9, y + h * .12, cy), { kind: "path", className: "flightEdge", d: `M ${x + w * .1} ${y + h * .9} H ${cx} V ${y + h * .1} M ${cx} ${cy} H ${x + w * .9}` }];
  if (stairStyle === "u") return [...horizontalTreads(y + h * .12, y + h * .88, x + w * .08, x + w * .42), ...horizontalTreads(y + h * .88, y + h * .12, x + w * .58, x + w * .92), { kind: "path", className: "flightEdge", d: `M ${x + w * .08} ${y + h * .08} V ${y + h * .92} H ${x + w * .92} V ${y + h * .08} M ${cx} ${y + h * .08} V ${y + h * .72}` }];
  if (stairStyle === "curved") { const radius = Math.max(w, h) * .82; return Array.from({ length: 9 }, (_, index) => ({ kind: "path", className: "tread", d: `M ${x + w * .08 + index * w * .035} ${y + h * .9} Q ${cx} ${y - radius * .18 + index * h * .06} ${x + w * .92} ${y + h * .9 - index * h * .035}` })); }
  return [...horizontalTreads(y + h * .1, y + h * .9), { kind: "path", className: "direction", d: `M ${cx} ${y + h * .86} V ${y + h * .14} m -2.2 2.2 2.2 -2.2 2.2 2.2` }];
}

export function stairGlyphMarkup(stairStyle: StairStyle, bounds: StairBounds, zoom: number) {
  const stroke = (width: number) => `fill="none" stroke-width="${width / Math.max(.0001, zoom)}"`;
  return `<g>${stairGlyphPrimitives(stairStyle, bounds).map((primitive) => {
    if (primitive.kind === "line") return `<line x1="${primitive.x1}" y1="${primitive.y1}" x2="${primitive.x2}" y2="${primitive.y2}" ${stroke(1)} stroke="#756449"/>`;
    if (primitive.kind === "circle") return primitive.className === "stairPost" ? `<circle cx="${primitive.cx}" cy="${primitive.cy}" r="${primitive.r}" fill="#4f4636" stroke="#ead8aa" stroke-width="${.8 / Math.max(.0001, zoom)}"/>` : `<circle cx="${primitive.cx}" cy="${primitive.cy}" r="${primitive.r}" ${stroke(1.8)} stroke="#4f4636"/>`;
    const extra = primitive.className === "direction" ? `stroke-linecap="round" stroke-linejoin="round"` : "";
    const width = primitive.className === "tread" ? 1 : primitive.className === "direction" ? 1.1 : 1.8;
    const color = primitive.className === "tread" ? "#756449" : primitive.className === "direction" ? "#9a4138" : "#4f4636";
    return `<path d="${primitive.d}" ${stroke(width)} stroke="${color}" ${extra}/>`;
  }).join("")}</g>`;
}
