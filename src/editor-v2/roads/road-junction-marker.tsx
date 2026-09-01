import type { RoadJunction } from "../model/project-model";

export function RoadJunctionMarker({ junction, radius, opacity = 1, transform }: { junction: RoadJunction; radius: number; opacity?: number; transform?: string }) {
  return <g transform={transform} opacity={opacity} pointerEvents="none" aria-hidden="true"><circle cx={junction.point.x} cy={junction.point.y} r={radius * 1.6} fill="none" stroke="currentColor" strokeWidth={Math.max(radius * .35, .7)} strokeDasharray={`${radius * .8} ${radius * .55}`}/><circle cx={junction.point.x} cy={junction.point.y} r={radius * .35} fill="currentColor"/></g>;
}
