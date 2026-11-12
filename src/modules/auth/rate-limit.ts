/**
 * Simple fixed-window rate limiter (per key, jaise IP address).
 * - Ek window (15 minute) mein MAX_REQUESTS se zyada request allow nahi.
 * - Data memory mein rehta hai, is liye server restart par reset hota hai.
 *   Production mein ye PostgreSQL table mein move hoga (agle batch mein).
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_KEYS = 10_000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();

  // Memory bachane ke liye purane buckets saaf karein
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
