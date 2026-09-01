/**
 * Small per-process cache for pure label geometry calculations.
 *
 * Layout inputs are fingerprinted by the caller. Entries are bounded so an
 * editor session that visits many places cannot retain every past view.
 */
export type LabelCache<V> = {
  get(key: string): { hit: boolean; value?: V };
  set(key: string, value: V): void;
  clear(): void;
  readonly size: number;
};

export function createLabelCache<V>(limit = 256): LabelCache<V> {
  const capacity = Math.max(1, Math.floor(limit));
  const entries = new Map<string, V>();
  return {
    get(key) {
      if (!entries.has(key)) return { hit: false };
      const value = entries.get(key)!;
      entries.delete(key);
      entries.set(key, value);
      return { hit: true, value };
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
    },
    clear() { entries.clear(); },
    get size() { return entries.size; },
  };
}

/** Stable enough for small JSON-like geometry values and independent of key order. */
export function labelValueFingerprint(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number") return Number.isNaN(value) ? "NaN" : String(value);
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(labelValueFingerprint).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).toSorted().map((key) => `${JSON.stringify(key)}:${labelValueFingerprint((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return String(value);
}
