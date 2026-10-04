// ponytail: in-memory, so each serverless instance (and cold start) counts on
// its own, and every check sweeps the map (fine for a few thousand active
// keys). Move to Upstash/Redis for a global limit.
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key: string, now = Date.now()) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      const current = windows.get(key) ?? { count: 0, resetAt: now + windowMs };
      windows.set(key, current);
      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
      }
      current.count++;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
