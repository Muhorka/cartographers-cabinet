const encoder = new TextEncoder();

export function serializedJsonBytes(value: string) {
  return encoder.encode(value).byteLength;
}

export function jsonBytes(value: unknown) {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 0 : serializedJsonBytes(serialized);
}

export function boundedBytes(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}

export function boundedCount(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}
