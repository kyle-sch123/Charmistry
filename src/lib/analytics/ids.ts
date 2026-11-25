/**
 * Random ids for visitors, sessions, page views, events and touches.
 *
 * Why client-generated uuids: the browser can batch and retry beacons, and the
 * database dedupes on these primary keys (insert ... on conflict do nothing),
 * so a retried batch never double-counts. They are random (v4), so they carry
 * nothing about the person.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Any uuid version, case-insensitive. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
