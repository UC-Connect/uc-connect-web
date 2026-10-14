import { getSupabaseAdmin } from "./supabase-admin.ts";

export type QuotaResult = { allowed: true } | { allowed: false; reason: "client" | "daily" };

const DEFAULT_DAILY_LIMIT = 400;

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Shared limits across all serverless instances: per-client minute/hour windows plus a
// site-wide daily cap that keeps the free Gemini quota from being used up. Fails open
// (allows the request) when Supabase is not configured or unreachable.
export async function consumeModelQuota(clientKey: string): Promise<QuotaResult> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return { allowed: true };
  }

  const dailyLimit = parseLimit(process.env.ADMISSIONS_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
  const { data, error } = await supabase.rpc("admissions_consume_quota", {
    p_buckets: [`client:${clientKey}:minute`, `client:${clientKey}:hour`, "global:day"],
    p_window_seconds: [60, 60 * 60, 24 * 60 * 60],
    p_limits: [6, 40, dailyLimit],
  });

  if (error) {
    console.error("[admissions-quota] check failed", error.message);
    return { allowed: true };
  }

  if (typeof data !== "string") {
    return { allowed: true };
  }

  return { allowed: false, reason: data === "global:day" ? "daily" : "client" };
}
