/**
 * A random v4 UUID for request and command ids (the `commandId` a durable command is deduplicated by).
 *
 * Not `crypto.randomUUID()`: browsers withhold it outside a secure context, and TMX is meant to be
 * servable over plain `http://` on a venue LAN (`Mentat/planning/TMX_DESKTOP_LOCAL_SERVER.md` §4.5).
 * `crypto.getRandomValues()` is available everywhere, so the bytes stay cryptographically random.
 *
 * Not the factory's `tools.UUID()` either: it draws from the factory's seedable random source, which
 * demos and `nonRandom` e2e seeds make deterministic — two sessions could then mint the same commandId
 * and the server would answer one with the other's stored receipt.
 */
export function randomId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
