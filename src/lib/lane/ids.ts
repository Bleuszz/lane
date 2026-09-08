export function makeId(prefix: string): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${raw.slice(0, 16)}`;
}

export function requestId(): string {
  return makeId("req");
}
