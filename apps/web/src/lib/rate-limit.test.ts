import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` calls per key per window, then says when to retry", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.check("a", 0)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.check("a", 1_000).allowed).toBe(true);
    expect(limiter.check("a", 30_500)).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect(limiter.check("b", 30_500).allowed).toBe(true);
    expect(limiter.check("a", 59_999)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    // The sweep drops expired windows, which is also what resets the key.
    expect(limiter.check("a", 60_000).allowed).toBe(true);
  });
});
