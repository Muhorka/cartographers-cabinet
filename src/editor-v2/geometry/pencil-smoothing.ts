import type { KernelPoint } from "./geometry-types";

/** Smooths only the freehand trace. Endpoints stay exact so snapping and intersections keep working downstream. */
export function smoothPencilPoints(points: readonly KernelPoint[], strength: number) {
  const amount = Math.max(0, Math.min(1, strength));
  if (amount <= 0 || points.length < 3) return [...points];
  let current = [...points]; const passes = amount > .66 ? 3 : amount > .32 ? 2 : 1;
  for (let pass = 0; pass < passes; pass += 1) current = current.map((point, index) => {
    if (index === 0 || index === current.length - 1) return point;
    const previous = current[index - 1]; const next = current[index + 1]; const weight = amount * .42;
    return { x: point.x * (1 - weight) + (previous.x + next.x) * weight / 2, y: point.y * (1 - weight) + (previous.y + next.y) * weight / 2 };
  });
  return current;
}

/** Applies the shared pencil policy to a gesture without changing other tools. */
export function smoothPencilGesture<T extends { instrumentId: string; points: readonly KernelPoint[] }>(gesture: T, strength: number): T {
  if (gesture.instrumentId !== "pencil") return gesture;
  return { ...gesture, points: smoothPencilPoints(gesture.points, strength) } as T;
}
