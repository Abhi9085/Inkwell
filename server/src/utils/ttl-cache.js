// Small bounded process-local TTL cache for non-sensitive public aggregates only.
// Use Redis for shared cache consistency when running multiple app instances.
class TTLCache {
  constructor({ ttlMs = 30_000, maxEntries = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) { this.entries.delete(key); return undefined; }
    return entry.value;
  }
  set(key, value) {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }
  clear() { this.entries.clear(); }
}
module.exports = TTLCache;
