const immutableSnapshots = new WeakSet<object>();

function rememberImmutable<T>(value: T): T {
  if (value && typeof value === "object") immutableSnapshots.add(value);
  return value;
}

/** True only for values produced by immutableSnapshot, including nested branches. */
export function isImmutableSnapshot(value: unknown): value is object {
  return Boolean(value && typeof value === "object" && immutableSnapshots.has(value));
}

/** JSON document snapshots share unchanged branches; no caller may mutate history. */
export function immutableSnapshot<T>(next: T, previous?: T): T {
  if (Object.is(next, previous) && isImmutableSnapshot(next)) return next;
  if (!next || typeof next !== "object") return next;
  const current = next as Record<string, unknown>;
  const prior = previous && typeof previous === "object" && Array.isArray(previous) === Array.isArray(next) ? previous as Record<string, unknown> : undefined;
  const keys = Object.keys(current);
  let unchanged = Boolean(prior && isImmutableSnapshot(prior)) && keys.length === Object.keys(prior!).length;
  const result: Record<string, unknown> = Array.isArray(next) ? [] as unknown as Record<string, unknown> : {};
  for (const key of keys) {
    const shared = immutableSnapshot(current[key], prior?.[key]);
    Object.defineProperty(result, key, { value: shared, enumerable: true, configurable: true, writable: true });
    if (!prior || !Object.hasOwn(prior, key) || !Object.is(shared, prior[key])) unchanged = false;
  }
  return rememberImmutable((unchanged ? previous : Object.freeze(result)) as T);
}
