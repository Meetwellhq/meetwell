import "server-only";
import { headers } from "next/headers";

/**
 * Small in-memory sliding-window limiter. It protects a single server
 * instance from bursts; on multi-instance deployments pair it with a shared
 * store (e.g. Upstash Redis) and Supabase Auth's built-in rate limits.
 */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
  return true;
}

/** Best-effort client identifier for rate limiting only. Never stored. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function limitByClient(action: string, limit: number, windowMs: number) {
  return rateLimit(`${action}:${await clientKey()}`, limit, windowMs);
}
