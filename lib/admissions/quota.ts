import { checkRateLimit, type Window } from "./rate-limit.ts";
import { getSupabaseAdmin } from "./supabase-admin.ts";

export type QuotaResult = { allowed: true } | { allowed: false; reason: "client" | "daily" | "budget" };

const DAY_SECONDS = 24 * 60 * 60;
const DEFAULT_DAILY_LIMIT = 400;
const DEFAULT_DAILY_BUDGET_CNY = 5;
const SPEND_BUCKET = "spend:global:day";
const MICRO = 1_000_000;

// Used when Supabase is not configured or unreachable: stricter, per instance, never unlimited.
const FALLBACK_CLIENT_WINDOWS: Window[] = [
  { limit: 3, ms: 60 * 1000 },
  { limit: 15, ms: 60 * 60 * 1000 },
];
const FALLBACK_INSTANCE_DAILY_CALLS = 100;

const memorySpend = { day: currentDay(), microCny: 0, calls: 0 };

function currentDay(now = Date.now()): number {
  return Math.floor(now / (DAY_SECONDS * 1000));
}

function parsePositive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function dailyBudgetMicroCny(): number {
  return Math.round(parsePositive(process.env.ADMISSIONS_DAILY_BUDGET_CNY, DEFAULT_DAILY_BUDGET_CNY) * MICRO);
}

function rollMemoryDay() {
  const day = currentDay();

  if (memorySpend.day !== day) {
    memorySpend.day = day;
    memorySpend.microCny = 0;
    memorySpend.calls = 0;
  }
}

function memoryQuota(clientKey: string): QuotaResult {
  rollMemoryDay();

  if (memorySpend.microCny >= dailyBudgetMicroCny()) return { allowed: false, reason: "budget" };
  if (memorySpend.calls >= FALLBACK_INSTANCE_DAILY_CALLS) return { allowed: false, reason: "daily" };
  if (!checkRateLimit(`fallback:${clientKey}`, Date.now(), FALLBACK_CLIENT_WINDOWS).allowed) return { allowed: false, reason: "client" };

  memorySpend.calls += 1;
  return { allowed: true };
}

// Shared limits across all serverless instances: per-client minute/hour/day windows, a site-wide
// daily call cap, and a site-wide daily spend budget (ADMISSIONS_DAILY_BUDGET_CNY). Falls back to
// stricter per-instance limits when Supabase is not configured or fails.
export async function consumeModelQuota(clientKey: string, extraBuckets: { bucket: string; windowSeconds: number; limit: number }[] = []): Promise<QuotaResult> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return memoryQuota(clientKey);
  }

  const dailyLimit = parsePositive(process.env.ADMISSIONS_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);

  try {
    const spend = await supabase.rpc("admissions_spend_status", { p_bucket: SPEND_BUCKET, p_window_seconds: DAY_SECONDS });

    if (spend.error) throw spend.error;
    if (Number(spend.data ?? 0) >= dailyBudgetMicroCny()) return { allowed: false, reason: "budget" };

    const buckets = [
      { bucket: `client:${clientKey}:minute`, windowSeconds: 60, limit: 6 },
      { bucket: `client:${clientKey}:hour`, windowSeconds: 60 * 60, limit: 40 },
      ...extraBuckets,
      { bucket: "global:day", windowSeconds: DAY_SECONDS, limit: dailyLimit },
    ];
    const { data, error } = await supabase.rpc("admissions_consume_quota", {
      p_buckets: buckets.map((entry) => entry.bucket),
      p_window_seconds: buckets.map((entry) => entry.windowSeconds),
      p_limits: buckets.map((entry) => entry.limit),
    });

    if (error) throw error;
    if (typeof data !== "string") return { allowed: true };
    return { allowed: false, reason: data === "global:day" ? "daily" : "client" };
  } catch (error) {
    console.error("[admissions-quota] Supabase check failed; using per-instance limits", error instanceof Error ? error.message : error);
    return memoryQuota(clientKey);
  }
}

// Adds a model call's estimated cost to today's spend.
export async function recordModelSpend(costCny: number): Promise<void> {
  const micro = Math.max(0, Math.round(costCny * MICRO));

  rollMemoryDay();
  memorySpend.microCny += micro;

  const supabase = getSupabaseAdmin();

  if (!supabase || micro === 0) {
    return;
  }

  const { error } = await supabase.rpc("admissions_add_spend", { p_bucket: SPEND_BUCKET, p_window_seconds: DAY_SECONDS, p_amount: micro });

  if (error) {
    console.error("[admissions-quota] recording spend failed", error.message);
  }
}

// Tests only.
export function resetMemoryQuota() {
  memorySpend.day = currentDay();
  memorySpend.microCny = 0;
  memorySpend.calls = 0;
}
