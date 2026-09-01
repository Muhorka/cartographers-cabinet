/**
 * JSON.stringify with deterministic ordering for plain object keys.
 * Arrays retain their authored order and JSON's undefined handling is kept.
 */
function stableObjectReplacer(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

export function stableJsonStringify(value: unknown): string | undefined {
  return JSON.stringify(value, stableObjectReplacer);
}

export function sameJsonValue(left: unknown, right: unknown): boolean {
  return stableJsonStringify(left) === stableJsonStringify(right);
}
