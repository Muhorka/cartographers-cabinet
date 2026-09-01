import type { KernelPoint } from "./geometry-types";
import type { MapLabelText } from "./map-area";
import { createLabelCache, labelValueFingerprint } from "./label-layout-cache";
import { prepareLabelFace, preparedDistanceToEdges, type LabelFace, type PreparedLabelFace, type PreparedLabelRing } from "./label-prepared-geometry";

type Face = LabelFace;

export type LabelObstacle = Face;

export type RoomLabelLayout = { text: string; x: number; y: number; fontSize: number; rotation: number; textLength: number; nameOffsetY?: number; secondaryLine?: { text: string; offsetY: number; fontSize: number; textLength: number } };

export type InteriorLabelOptions = {
  minimumScreenSize?: number;
  preferredScreenSize?: number;
  maximumScreenSize?: number;
  allowCompact?: boolean;
  obstacles?: readonly LabelObstacle[];
};

const roomLayoutCache = createLabelCache<RoomLabelLayout | undefined>(512);

export function clearRoomLabelLayoutCache() { roomLayoutCache.clear(); }
export function roomLabelLayoutCacheSize() { return roomLayoutCache.size; }

export function roomLabelLayout(name: MapLabelText, face: Face, zoom: number, options: InteriorLabelOptions = {}): RoomLabelLayout | undefined {
  const key = labelValueFingerprint({ name, face, zoom, minimumScreenSize: options.minimumScreenSize ?? 4.5, preferredScreenSize: Math.max(options.minimumScreenSize ?? 4.5, options.preferredScreenSize ?? 8), maximumScreenSize: options.maximumScreenSize ?? 15, allowCompact: options.allowCompact ?? false, obstacles: options.obstacles ?? [] });
  const cached = roomLayoutCache.get(key);
  if (cached.hit) return cached.value;
  const result = freezeRoomLabelLayout(roomLabelLayoutUncached(name, face, zoom, options));
  roomLayoutCache.set(key, result);
  return result;
}

function freezeRoomLabelLayout(layout: RoomLabelLayout | undefined) {
  if (!layout) return layout;
  if (layout.secondaryLine) Object.freeze(layout.secondaryLine);
  return Object.freeze(layout) as RoomLabelLayout;
}

function roomLabelLayoutUncached(name: MapLabelText, face: Face, zoom: number, options: InteriorLabelOptions = {}): RoomLabelLayout | undefined {
  if (typeof name !== "string") return areaLabelLayout(name, face, zoom, options);
  if (face.outer.length < 3 || zoom <= 0) return undefined;
  const minimum = options.minimumScreenSize ?? 4.5;
  const preferred = Math.max(minimum, options.preferredScreenSize ?? 8);
  const maximum = options.maximumScreenSize ?? 15;
  const preparedFace = prepareLabelFace(face);
  const obstacles = options.obstacles?.map(prepareLabelFace);
  const rings = preparedFace.rings;
  const angles = candidateAngles(preparedFace.outer.points);
  const hasObstacles = Boolean(obstacles?.length);
  const candidates: LayoutCandidate[] = [];
  let firstFreeHorizontal: LayoutCandidate | undefined;
  for (const anchor of candidateAnchors(preparedFace, obstacles)) {
    const anchorEdgeDistance = hasObstacles ? preparedDistanceToEdges(anchor, rings) : undefined;
    for (const rotation of angles) {
      const candidate = buildCandidate(name, preparedFace, rings, anchor, rotation, zoom, maximum, obstacles, hasObstacles, anchorEdgeDistance);
      if (!candidate) continue;
      if (candidate.obstacleFree && rotation === 0 && !firstFreeHorizontal) {
        firstFreeHorizontal = candidate;
        if (candidate.fullSize >= preferred) return candidate.fullLayout;
      }
      candidates.push(candidate);
    }
  }
  if (!candidates.length) return undefined;
  const obstacleFree = (candidate: (typeof candidates)[number]) => candidate.obstacleFree;
  const preferredCandidates = candidates.filter(obstacleFree);
  const availableCandidates = preferredCandidates.length ? preferredCandidates : candidates;
  const horizontal = availableCandidates.find(({ rotation }) => rotation === 0);
  if (horizontal && horizontal.fullSize >= preferred) return horizontal.fullLayout;
  const diagonalFull = availableCandidates.filter(({ fullSize }) => fullSize >= preferred).toSorted((first, second) => second.fullSize - first.fullSize || Math.abs(first.rotation) - Math.abs(second.rotation))[0];
  if (diagonalFull) return diagonalFull.fullLayout;
  const reducedFull = availableCandidates.filter(({ fullSize }) => fullSize >= minimum).toSorted((first, second) => second.fullSize - first.fullSize || Math.abs(first.rotation) - Math.abs(second.rotation))[0];
  if (reducedFull) return reducedFull.fullLayout;
  // A tiny complete label is preferable to hiding or abbreviating an authored name.
  const tinyFull = availableCandidates.toSorted((first, second) => second.fullSize - first.fullSize || Math.abs(first.rotation) - Math.abs(second.rotation))[0];
  return tinyFull?.fullLayout;
}

type LayoutCandidate = { rotation: number; screenWidth: number; fullSize: number; anchor: KernelPoint; fullLayout: RoomLabelLayout; obstacleFree: boolean };

function buildCandidate(name: string, face: PreparedLabelFace, rings: readonly PreparedLabelRing[], anchor: KernelPoint, rotation: number, zoom: number, maximum: number, obstacles: readonly PreparedLabelFace[] | undefined, hasObstacles: boolean, anchorEdgeDistance: number | undefined): LayoutCandidate | undefined {
  const span = directionalSpan(face, anchor, rotation); if (!span) return undefined;
  // Preserve sampled anchors while avoiding obstacles; centering the span would
  // collapse every grid candidate back onto the same occupied midpoint.
  const labelAnchor = hasObstacles ? anchor : offsetAlong(anchor, rotation, (span.left + span.right) / 2);
  const screenHeight = (hasObstacles ? anchorEdgeDistance! : preparedDistanceToEdges(labelAnchor, rings)) * 2 * zoom * .82;
  const screenWidth = (span.right - span.left) * zoom * .68;
  if (!(screenHeight > 0) || !(screenWidth > 0)) return undefined;
  const fullSize = fittedSize(name, screenWidth, screenHeight, maximum);
  if (!(fullSize > 0)) return undefined;
  const fullLayout = fitFullLayout(name, labelAnchor, fullSize, screenWidth, zoom, rotation, face);
  if (!fullLayout) return undefined;
  const obstacleFreeLayout = fitObstacleFreeLayout(fullLayout, face, obstacles, screenWidth, zoom);
  const selectedLayout = obstacleFreeLayout ?? fullLayout;
  return { rotation, screenWidth, fullSize: selectedLayout.fontSize * zoom, anchor: labelAnchor, fullLayout: selectedLayout, obstacleFree: Boolean(obstacleFreeLayout) || !labelBoxIntersectsObstacles(labelBox(fullLayout), obstacles) };
}

function areaLabelLayout(caption: Exclude<MapLabelText, string>, face: Face, zoom: number, options: InteriorLabelOptions): RoomLabelLayout | undefined {
  const title = roomLabelLayout(caption.name, face, zoom, { ...options, allowCompact: false });
  const preparedFace = prepareLabelFace(face);
  const obstacles = options.obstacles?.map(prepareLabelFace);
  if (title) for (const scale of [1, .9, .8]) {
    const fontSize = title.fontSize * scale; const areaSize = fontSize * .78;
    if (areaSize * zoom < 3.2) continue;
    const nameWidth = title.textLength * scale; const areaWidth = caption.area.length * areaSize * .64;
    const radians = title.rotation * Math.PI / 180; const cos = Math.cos(radians); const sin = Math.sin(radians);
    const width = Math.max(nameWidth, areaWidth) * 1.08;
    const local = (x: number, y: number) => ({ x: title.x + cos * x - sin * y, y: title.y + sin * x + cos * y });
    // Check both rows, including the perimeter, against the actual face and holes.
    const fits = Array.from({ length: 17 }, (_, column) => Array.from({ length: 7 }, (_, row) => local((column / 16 - .5) * width, (row / 6 * 2.35 - 1.2) * fontSize))).flat().every((point) => preparedFace.contains(point) && !(obstacles ?? []).some((obstacle) => obstacle.contains(point)));
    if (fits) return { ...title, fontSize, textLength: nameWidth, nameOffsetY: -.5 * fontSize, secondaryLine: { text: caption.area, offsetY: .65 * fontSize, fontSize: areaSize, textLength: areaWidth } };
  }
  return roomLabelLayout(`${caption.name} · ${caption.area}`, face, zoom, { ...options, allowCompact: false });
}

function candidateAnchors(face: PreparedLabelFace, obstacles?: readonly PreparedLabelFace[]) {
  const bounds = face.bounds;
  const points = [{ x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 }, centroid(face.outer.points)];
  const columns = 16; const rows = 16;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) points.push({
    x: bounds.left + (column + .5) / columns * (bounds.right - bounds.left),
    y: bounds.top + (row + .5) / rows * (bounds.bottom - bounds.top),
  });
  const seen = new Set<string>();
  const unique = points.filter((point) => {
    if (!face.contains(point)) return false;
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.map((point, index) => ({ point, index, score: anchorScore(point, face, obstacles) }))
    .toSorted((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, 48)
    .map(({ point }) => point);
}

function anchorScore(point: KernelPoint, face: PreparedLabelFace, obstacles?: readonly PreparedLabelFace[]) {
  const edgeDistance = preparedDistanceToEdges(point, face.rings);
  const obstacleDistance = obstacles?.length ? Math.min(...obstacles.map((obstacle) => obstacle.contains(point) ? 0 : preparedDistanceToEdges(point, [obstacle.outer]))) : 0;
  return edgeDistance + obstacleDistance * .25 + (face.contains(point) ? 0 : -1000);
}

function directionalSpan(face: PreparedLabelFace, anchor: KernelPoint, rotation: number) {
  const radians = rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const local = (point: KernelPoint) => ({ x: (point.x - anchor.x) * cosine + (point.y - anchor.y) * sine, y: -(point.x - anchor.x) * sine + (point.y - anchor.y) * cosine });
  const intersections = face.rings.flatMap((ring) => ring.points.flatMap((point, index) => {
    const first = local(point); const next = local(ring.points[(index + 1) % ring.points.length]!);
    if ((first.y > 0) === (next.y > 0)) return [];
    return [first.x + -first.y * (next.x - first.x) / (next.y - first.y)];
  })).toSorted((first, second) => first - second);
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    if (0 >= intersections[index] && 0 <= intersections[index + 1]) return { left: intersections[index], right: intersections[index + 1] };
  }
  return undefined;
}

function candidateAngles(points: readonly KernelPoint[]) {
  const edges = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!; const dx = next.x - point.x; const dy = next.y - point.y;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI; while (angle > 90) angle -= 180; while (angle < -90) angle += 180;
    return { angle: Math.abs(angle) > 78 ? Math.sign(angle) * 90 : angle, length: Math.hypot(dx, dy) };
  }).toSorted((first, second) => second.length - first.length);
  const angles = [0];
  for (const { angle } of edges) if (Math.abs(angle) >= 8 && !angles.some((candidate) => Math.abs(candidate - angle) < 5)) angles.push(Math.round(angle * 10) / 10);
  return angles.slice(0, 7);
}

function centroid(points: readonly KernelPoint[]) { return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length }; }
function fittedSize(text: string, width: number, height: number, maximum: number) { return Math.min(maximum, height * .66, width / Math.max(3, text.length * .64)); }
function offsetAlong(point: KernelPoint, rotation: number, amount: number) { const radians = rotation * Math.PI / 180; return { x: point.x + Math.cos(radians) * amount, y: point.y + Math.sin(radians) * amount }; }
function layout(text: string, anchor: KernelPoint, screenSize: number, availableScreenWidth: number, zoom: number, rotation: number, tight = false): RoomLabelLayout {
  const naturalWidth = screenSize * text.length * .57;
  const stretchLimit = Math.abs(rotation) >= 8 ? 1.85 : 1.2;
  const usedWidth = tight ? Math.min(availableScreenWidth, naturalWidth) : Math.min(availableScreenWidth, naturalWidth * stretchLimit, Math.max(naturalWidth, availableScreenWidth * .78));
  return { text, x: anchor.x, y: anchor.y, fontSize: screenSize / zoom, rotation, textLength: usedWidth / zoom };
}

function fitFullLayout(text: string, anchor: KernelPoint, maximumScreenSize: number, availableScreenWidth: number, zoom: number, rotation: number, face: PreparedLabelFace) {
  const initial = layout(text, anchor, maximumScreenSize, availableScreenWidth, zoom, rotation);
  if (labelBoxFits(face, labelBox(initial))) return initial;
  let lower = 0; let upper = maximumScreenSize;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const size = (lower + upper) / 2; const candidate = layout(text, anchor, size, availableScreenWidth, zoom, rotation, true);
    if (labelBoxFits(face, labelBox(candidate))) lower = size; else upper = size;
  }
  if (lower <= 1e-6) return undefined;
  return layout(text, anchor, lower, availableScreenWidth, zoom, rotation, true);
}

function fitObstacleFreeLayout(initial: RoomLabelLayout, face: PreparedLabelFace, obstacles: readonly PreparedLabelFace[] | undefined, availableScreenWidth: number, zoom: number) {
  if (!obstacles?.length || !labelBoxIntersectsObstacles(labelBox(initial), obstacles)) return initial;
  let lower = 0; let upper = initial.fontSize * zoom;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const size = (lower + upper) / 2;
    const candidate = layout(initial.text, { x: initial.x, y: initial.y }, size, availableScreenWidth, zoom, initial.rotation, true);
    if (labelBoxFits(face, labelBox(candidate)) && !labelBoxIntersectsObstacles(labelBox(candidate), obstacles)) lower = size; else upper = size;
  }
  if (lower <= 1e-6) return undefined;
  return layout(initial.text, { x: initial.x, y: initial.y }, lower, availableScreenWidth, zoom, initial.rotation, true);
}

type LabelBox = { center: KernelPoint; width: number; height: number; rotation: number };

function labelBox(layout: RoomLabelLayout): LabelBox {
  return { center: { x: layout.x, y: layout.y }, width: layout.textLength, height: Math.max(layout.fontSize * 1.05, .01), rotation: layout.rotation };
}

export function labelObstacleForLayout(layout: RoomLabelLayout): LabelObstacle {
  const titleOffset = layout.nameOffsetY ?? 0;
  const secondaryTop = layout.secondaryLine ? layout.secondaryLine.offsetY - layout.secondaryLine.fontSize * .525 : titleOffset - layout.fontSize * .525;
  const secondaryBottom = layout.secondaryLine ? layout.secondaryLine.offsetY + layout.secondaryLine.fontSize * .525 : titleOffset + layout.fontSize * .525;
  const top = Math.min(titleOffset - layout.fontSize * .525, secondaryTop); const bottom = Math.max(titleOffset + layout.fontSize * .525, secondaryBottom);
  const radians = layout.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians); const centerOffset = (top + bottom) / 2;
  const box = { center: { x: layout.x - sine * centerOffset, y: layout.y + cosine * centerOffset }, width: Math.max(layout.textLength, layout.secondaryLine?.textLength ?? 0), height: Math.max(bottom - top, .01), rotation: layout.rotation };
  const corner = (x: number, y: number) => ({ x: box.center.x + cosine * x - sine * y, y: box.center.y + sine * x + cosine * y });
  return { outer: [corner(-box.width / 2, -box.height / 2), corner(box.width / 2, -box.height / 2), corner(box.width / 2, box.height / 2), corner(-box.width / 2, box.height / 2)] };
}

function labelBoxPoints(box: LabelBox) {
  const radians = box.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const local = (x: number, y: number) => ({ x: box.center.x + cosine * x - sine * y, y: box.center.y + sine * x + cosine * y });
  const points: KernelPoint[] = [];
  for (let row = 0; row <= 4; row += 1) for (let column = 0; column <= 4; column += 1) points.push(local((column / 4 - .5) * box.width, (row / 4 - .5) * box.height));
  return points;
}

function labelBoxFits(face: PreparedLabelFace, box: LabelBox) {
  return labelBoxPoints(box).every(face.contains);
}

function labelBoxIntersectsObstacles(box: LabelBox, obstacles?: readonly PreparedLabelFace[]) {
  const points = labelBoxPoints(box);
  return (obstacles ?? []).some((obstacle) => points.some((point) => obstacle.contains(point)));
}
