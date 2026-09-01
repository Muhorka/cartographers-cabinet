import { describe, expect, it } from "vitest";
import type { CanonicalWall } from "./geometry-types";
import { normalizePoint } from "./geometry-normalization";
import { buildWallNetwork, materializeWallSegments } from "./wall-network-kernel";

const wall = (id: string, a: number[], b: number[]): CanonicalWall => ({ id, start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, role: "partition", thickness: .22 });

describe("rounded junctions on oblique walls", () => {
  it.each([.079458, .731421, 2.318741])("closes T junctions on a wall tilted by %s", (rise) => {
    const width = 20.432244; const joinX = 13.229254;
    const at = normalizePoint({ x: joinX, y: rise * joinX / width });
    const walls = [wall("top", [0, 0], [width, rise]), wall("right", [width, rise], [width, 15]), wall("bottom", [width, 15], [0, 15]), wall("left", [0, 15], [0, 0]), wall("divider", [at.x, at.y], [at.x, 15])];
    const first = buildWallNetwork(walls);
    expect(first.faces).toHaveLength(2);
    expect(first.diagnostics).toEqual([]);
    const persisted = materializeWallSegments(walls);
    expect(buildWallNetwork(persisted).faces.map(({ id }) => id)).toEqual(first.faces.map(({ id }) => id));
    expect(materializeWallSegments(persisted)).toEqual(persisted);
  });
});
