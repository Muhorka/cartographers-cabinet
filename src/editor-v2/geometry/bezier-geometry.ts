import type { BezierNode, KernelPoint } from "./geometry-types";

function cubic(first: BezierNode, second: BezierNode, ratio: number): KernelPoint {
  const start = first.anchor; const controlA = first.outHandle ?? start; const end = second.anchor; const controlB = second.inHandle ?? end; const inverse = 1 - ratio;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * ratio * controlA.x + 3 * inverse * ratio ** 2 * controlB.x + ratio ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * ratio * controlA.y + 3 * inverse * ratio ** 2 * controlB.y + ratio ** 3 * end.y,
  };
}

export function bezierPathData(nodes: BezierNode[], closed = false) {
  if (nodes.length < 2) return ""; const first = nodes[0].anchor; const commands = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1]; const current = nodes[index]; const a = previous.outHandle ?? previous.anchor; const b = current.inHandle ?? current.anchor;
    commands.push(`C ${a.x} ${a.y}, ${b.x} ${b.y}, ${current.anchor.x} ${current.anchor.y}`);
  }
  if (closed) {
    const previous = nodes.at(-1)!; const a = previous.outHandle ?? previous.anchor; const b = nodes[0].inHandle ?? first;
    commands.push(`C ${a.x} ${a.y}, ${b.x} ${b.y}, ${first.x} ${first.y} Z`);
  }
  return commands.join(" ");
}

export function sampleBezier(nodes: BezierNode[], closed: boolean, steps = 16) {
  if (nodes.length < 2) return nodes.map(({ anchor }) => anchor);
  const pairs = closed ? nodes.map((node, index) => [node, nodes[(index + 1) % nodes.length]] as const) : nodes.slice(0, -1).map((node, index) => [node, nodes[index + 1]] as const);
  return pairs.flatMap(([first, second], pairIndex) => Array.from({ length: steps + 1 }, (_, index) => cubic(first, second, index / steps)).filter((_, index) => pairIndex === 0 || index > 0));
}

export function translateBezier(nodes: BezierNode[], delta: KernelPoint) {
  const point = ({ x, y }: KernelPoint) => ({ x: x + delta.x, y: y + delta.y });
  return nodes.map((node) => ({ anchor: point(node.anchor), ...(node.inHandle ? { inHandle: point(node.inHandle) } : {}), ...(node.outHandle ? { outHandle: point(node.outHandle) } : {}) }));
}

export function scaleBezier(nodes: BezierNode[], anchor: KernelPoint, scale: KernelPoint) {
  const point = ({ x, y }: KernelPoint) => ({ x: anchor.x + (x - anchor.x) * scale.x, y: anchor.y + (y - anchor.y) * scale.y });
  return nodes.map((node) => ({ anchor: point(node.anchor), ...(node.inHandle ? { inHandle: point(node.inHandle) } : {}), ...(node.outHandle ? { outHandle: point(node.outHandle) } : {}) }));
}
