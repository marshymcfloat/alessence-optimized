import { ApiError } from "./http";

const globalStore = globalThis as unknown as {
  rateLimits?: Map<string, { count: number; resetAt: number }>;
};
const store = (globalStore.rateLimits ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new ApiError(429, "Too many requests. Try again later.", "RATE_LIMITED");
  }
  current.count++;
}
