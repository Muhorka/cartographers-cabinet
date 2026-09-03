import { stableHash } from "./geometry-normalization";

/**
 * Encodes an authored identifier for use in an SVG id or URL fragment.
 *
 * Sanitising alone is not enough here: for example, `a:b` and `a?b` would
 * both become `a-b`. Keep the readable form for already-safe ids and append
 * a stable hash whenever encoding changed the value.
 */
export function svgId(value: string) {
  const source = String(value ?? "");
  const sanitized = source.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  if (source.length > 0 && source.length <= 80 && sanitized === source) return source;
  return `${sanitized.slice(0, 64) || "id"}-${stableHash(source)}`;
}
