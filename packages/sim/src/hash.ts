/** Deterministic uniform number in [0, 1) from (seed, day, key): FNV-1a over the key, mixed with seed and day. */
export function hash01(seed: number, day: number, key: string): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= Math.imul(day + 0x9e3779b9, 0x85ebca6b);
  // murmur3 finaliser
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
