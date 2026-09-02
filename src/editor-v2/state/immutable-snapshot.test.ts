import { describe, expect, it } from "vitest";
import { immutableSnapshot, isImmutableSnapshot } from "./immutable-snapshot";

describe("immutableSnapshot identity", () => {
  it("marks every object branch it freezes", () => {
    const source = { nested: { value: 1 }, items: [{ id: "one" }] };
    expect(isImmutableSnapshot(source)).toBe(false);
    expect(isImmutableSnapshot(source.nested)).toBe(false);

    const snapshot = immutableSnapshot(source);
    expect(isImmutableSnapshot(snapshot)).toBe(true);
    expect(isImmutableSnapshot(snapshot.nested)).toBe(true);
    expect(isImmutableSnapshot(snapshot.items)).toBe(true);
    expect(isImmutableSnapshot(snapshot.items[0])).toBe(true);
    expect(() => { snapshot.nested.value = 2; }).toThrow();
  });

  it("shares only previously marked snapshots", () => {
    const source = { nested: { value: 1 } };
    const unsafeSameInput = immutableSnapshot(source, source);
    expect(unsafeSameInput).not.toBe(source);
    expect(isImmutableSnapshot(unsafeSameInput)).toBe(true);

    const next = immutableSnapshot({ nested: { value: 1 } }, unsafeSameInput);
    expect(next).toBe(unsafeSameInput);
    expect(next.nested).toBe(unsafeSameInput.nested);
  });
});
