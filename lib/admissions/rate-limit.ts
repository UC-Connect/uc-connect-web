export type Window = { limit: number; ms: number };

const DEFAULT_WINDOWS: Window[] = [
  { limit: 6, ms: 60 * 1000 },
  { limit: 40, ms: 60 * 60 * 1000 },
];
const MAX_TRACKED_KEYS = 5000;
const hits = new Map<string, number[]>();

// Best-effort per-instance limiter. Serverless instances do not share memory, so this only
// slows down bursts against one instance; a shared store (e.g. Supabase) is needed for strict limits.
export function checkRateLimit(key: string, now = Date.now(), windows: Window[] = DEFAULT_WINDOWS): { allowed: boolean; retryAfterSeconds: number } {
  const longest = Math.max(...windows.map((window) => window.ms));
  const recent = (hits.get(key) ?? []).filter((time) => now - time < longest);

  for (const window of windows) {
    const inWindow = recent.filter((time) => now - time < window.ms);

    if (inWindow.length >= window.limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.ceil((inWindow[0] + window.ms - now) / 1000) };
    }
  }

  if (!hits.has(key) && hits.size >= MAX_TRACKED_KEYS) {
    hits.delete(hits.keys().next().value as string);
  }

  hits.set(key, [...recent, now]);
  return { allowed: true, retryAfterSeconds: 0 };
}
