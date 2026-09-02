import { describe, expect, it } from "vitest";
import { immutableSnapshot, isImmutableSnapshot } from "./immutable-snapshot";

describe("immutable snapshot identity", () => {
  it("never brands a mutable value merely because next and previous are identical", () => {
    const mutable = { nested: { value: 1 } };
    const snapshot = immutableSnapshot(mutable, mutable);

    expect(snapshot).not.toBe(mutable);
    expect(snapshot.nested).not.toBe(mutable.nested);
    expect(isImmutableSnapshot(snapshot)).toBe(true);
    expect(isImmutableSnapshot(snapshot.nested)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nested)).toBe(true);
    mutable.nested.value = 2;
    expect(snapshot.nested.value).toBe(1);

    const primitiveOnly = { value: 1 };
    const primitiveSnapshot = immutableSnapshot(primitiveOnly, primitiveOnly);
    expect(primitiveSnapshot).not.toBe(primitiveOnly);
    expect(isImmutableSnapshot(primitiveSnapshot)).toBe(true);
    expect(Object.isFrozen(primitiveSnapshot)).toBe(true);
  });
});
